import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import YooKassa from 'yookassa';
import gigachatService from './services/gigachat.js';
import cron from 'node-cron';
import axios from 'axios';

dotenv.config();

// Проверка обязательных переменных окружения
const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'YOOKASSA_SHOP_ID',
  'YOOKASSA_SECRET_KEY',
  'UPDATE_SECRET',
  'GIGACHAT_CLIENT_ID',
  'GIGACHAT_CLIENT_SECRET'
];
for (const envVar of requiredEnv) {
  if (!process.env[envVar]) {
    console.error(`❌ Ошибка: переменная окружения ${envVar} не задана. Сервер остановлен.`);
    process.exit(1);
  }
}

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Инициализация YooKassa
const yooKassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY
});

app.use(cors());
app.use(express.json());

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Недействительный токен' });
    req.user = user;
    next();
  });
};

// ---------- РОУТЫ ----------

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, email, password, ref, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password, referred_by, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [username, email, hashedPassword, ref || null, role || 'subscriber']
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
    } else {
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
});

// Отслеживание просмотра поста
app.post('/api/track-view', authenticateToken, async (req, res) => {
  const { postId, duration } = req.body;
  const userId = req.user.id;
  try {
    await pool.query(
      'INSERT INTO content_views (user_id, post_id, view_duration) VALUES ($1, $2, $3)',
      [userId, postId, duration || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при отслеживании просмотра' });
  }
});

// Оценка автора (лайк/дизлайк)
app.post('/api/rate-creator', authenticateToken, async (req, res) => {
  const { creatorId, score } = req.body;
  const userId = req.user.id;
  if (score < -5 || score > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от -5 до 5' });
  }
  try {
    await pool.query(
      `INSERT INTO user_preferences (user_id, creator_id, preference_score)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, creator_id) 
       DO UPDATE SET preference_score = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, creatorId, score]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при сохранении оценки' });
  }
});

// Получение персональных рекомендаций
app.get('/api/recommendations', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 10;
  try {
    const similarUsers = await pool.query(`
      SELECT user2_id, similarity_score 
      FROM user_similarity 
      WHERE user1_id = $1 
      ORDER BY similarity_score DESC 
      LIMIT 5
    `, [userId]);

    if (similarUsers.rows.length === 0) {
      const popularPosts = await pool.query(`
        SELECT p.*, c.name as creator_name, COUNT(v.id) as view_count
        FROM posts p
        JOIN creators c ON p.creator_id = c.id
        LEFT JOIN content_views v ON p.id = v.post_id
        WHERE p.is_paid = false
        GROUP BY p.id, c.name
        ORDER BY view_count DESC
        LIMIT $1
      `, [limit]);
      return res.json(popularPosts.rows);
    }

    const similarUserIds = similarUsers.rows.map(r => r.user2_id);
    const recommendations = await pool.query(`
      SELECT DISTINCT p.*, c.name as creator_name,
             AVG(up.preference_score) as avg_preference
      FROM posts p
      JOIN creators c ON p.creator_id = c.id
      JOIN user_preferences up ON c.id = up.creator_id
      WHERE up.user_id = ANY($1::int[])
        AND up.preference_score > 0
        AND p.is_paid = false
        AND p.creator_id NOT IN (
          SELECT creator_id FROM subscriptions WHERE user_id = $2
        )
      GROUP BY p.id, c.name
      ORDER BY avg_preference DESC
      LIMIT $3
    `, [similarUserIds, userId, limit]);

    res.json(recommendations.rows);
  } catch (err) {
    console.error('Ошибка получения рекомендаций:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Функция обновления матрицы сходства (вынесена для переиспользования)
async function updateSimilarity() {
  await pool.query('TRUNCATE user_similarity');
  await pool.query(`
    INSERT INTO user_similarity (user1_id, user2_id, similarity_score)
    WITH subscriptions_agg AS (
      SELECT user_id, array_agg(creator_id) as creators
      FROM subscriptions
      GROUP BY user_id
    )
    SELECT 
      a.user_id AS user1_id,
      b.user_id AS user2_id,
      CAST(ARRAY_LENGTH(a.creators & b.creators, 1) AS FLOAT) / 
      CAST(ARRAY_LENGTH(a.creators | b.creators, 1) AS FLOAT) AS similarity
    FROM subscriptions_agg a
    JOIN subscriptions_agg b ON a.user_id < b.user_id
    WHERE ARRAY_LENGTH(a.creators, 1) > 0 
      AND ARRAY_LENGTH(b.creators, 1) > 0
  `);
}

// Эндпоинт для ручного запуска обновления сходства
app.post('/api/update-similarity', async (req, res) => {
  const secret = req.headers['x-update-secret'];
  if (secret !== process.env.UPDATE_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await updateSimilarity();
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка обновления сходства:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Список всех создателей (публичный)
app.get('/api/creators', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, bio, price, category FROM creators');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Профиль создателя и его бесплатные посты
app.get('/api/creator/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const creatorResult = await pool.query('SELECT * FROM creators WHERE id = $1', [id]);
    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Создатель не найден' });
    }
    const postsResult = await pool.query(
      'SELECT id, title, content, created_at FROM posts WHERE creator_id = $1 AND is_paid = false ORDER BY created_at DESC',
      [id]
    );
    res.json({
      ...creatorResult.rows[0],
      freePosts: postsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание платежа (подписка)
app.post('/api/create-payment', authenticateToken, async (req, res) => {
  const { amount, creatorId } = req.body;
  const userId = req.user.id;
  try {
    const payment = await yooKassa.createPayment({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: 'https://твой-сайт.ru/success' }, // замените на свой URL
      description: `Подписка на создателя #${creatorId}`,
      metadata: { userId, creatorId }
    });
    res.json({ confirmation_url: payment.confirmation.confirmation_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания платежа' });
  }
});

// Webhook для уведомлений от YooKassa
app.post('/api/payment-callback', async (req, res) => {
  const event = req.body;
  if (event.event === 'payment.succeeded') {
    const { userId, creatorId } = event.object.metadata;
    try {
      await pool.query(
        'INSERT INTO subscriptions (user_id, creator_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 month\')',
        [userId, creatorId]
      );

      const subscriberResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const creatorResult = await pool.query('SELECT name FROM creators WHERE id = $1', [creatorId]);
      const subscriberName = subscriberResult.rows[0]?.username;
      const creatorName = creatorResult.rows[0]?.name;

      const notificationData = {
        subscriberId: userId,
        creatorId: creatorId,
        subscriberName: subscriberName,
        creatorName: creatorName
      };
      await pool.query(
        'INSERT INTO notifications (user_id, type, data) VALUES (NULL, $1, $2)',
        ['subscription', notificationData]
      );

      const userResult = await pool.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
      const referrerId = userResult.rows[0]?.referred_by;
      if (referrerId) {
        const bonus = event.object.amount.value * 0.1;
        await pool.query(
          'INSERT INTO referral_bonuses (user_id, amount, source_user_id) VALUES ($1, $2, $3)',
          [referrerId, bonus, userId]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка при обработке платежа' });
    }
  } else {
    res.json({ success: true });
  }
});

// Получить данные текущего пользователя
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    const creatorResult = await pool.query('SELECT id FROM creators WHERE user_id = $1', [req.user.id]);
    const isCreator = creatorResult.rows.length > 0;
    const creatorId = isCreator ? creatorResult.rows[0].id : null;

    let posts = [];
    if (isCreator) {
      const postsResult = await pool.query('SELECT * FROM posts WHERE creator_id = $1 ORDER BY created_at DESC', [creatorId]);
      posts = postsResult.rows;
    }

    const bonusResult = await pool.query('SELECT SUM(amount) as total FROM referral_bonuses WHERE user_id = $1', [req.user.id]);

    res.json({
      user: { ...user, isCreator, creatorId },
      posts,
      referralBalance: bonusResult.rows[0]?.total || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Создание поста (только для создателей)
app.post('/api/posts', authenticateToken, async (req, res) => {
  const { title, content, isPaid, price } = req.body;
  const userId = req.user.id;
  try {
    const creatorCheck = await pool.query('SELECT id FROM creators WHERE user_id = $1', [userId]);
    if (creatorCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Вы не являетесь создателем' });
    }
    const creatorId = creatorCheck.rows[0].id;
    const result = await pool.query(
      'INSERT INTO posts (creator_id, title, content, is_paid, price) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [creatorId, title, content, isPaid, isPaid ? price : null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при создании поста' });
  }
});

// Получить посты текущего пользователя
app.get('/api/user/posts', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const creatorResult = await pool.query('SELECT id FROM creators WHERE user_id = $1', [userId]);
    if (creatorResult.rows.length === 0) {
      return res.json([]);
    }
    const creatorId = creatorResult.rows[0].id;
    const posts = await pool.query('SELECT * FROM posts WHERE creator_id = $1 ORDER BY created_at DESC', [creatorId]);
    res.json(posts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить публичные уведомления
app.get('/api/notifications', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  try {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id IS NULL 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить личные уведомления пользователя
app.get('/api/notifications/me', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  try {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC 
       LIMIT $2`,
      [req.user.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отметить уведомление как прочитанное
app.post('/api/notifications/read/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Генерация идей для поста (AI)
app.post('/api/ai/generate-ideas', authenticateToken, async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Укажите тему' });
  }
  try {
    const ideas = await gigachatService.generatePostIdeas(topic);
    res.json({ ideas });
  } catch (error) {
    console.error('Ошибка генерации идей:', error);
    res.status(500).json({ error: 'Ошибка генерации' });
  }
});

// Получение трендов (AI)
app.get('/api/ai/trends', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'creator') {
      return res.status(403).json({ error: 'Только для авторов' });
    }
    const trends = await gigachatService.getTrends();
    res.json({ trends });
  } catch (error) {
    console.error('Ошибка получения трендов:', error);
    res.status(500).json({ error: 'Ошибка получения трендов' });
  }
});

// Улучшение текста поста (AI)
app.post('/api/ai/enhance-post', authenticateToken, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Введите текст' });
  }
  try {
    const enhanced = await gigachatService.generateText(
      `Улучши этот текст для социальных сетей: "${text}". Сделай его более цепляющим, добавь эмоций, но сохрани смысл.`
    );
    res.json({ enhanced });
  } catch (error) {
    console.error('Ошибка улучшения текста:', error);
    res.status(500).json({ error: 'Ошибка улучшения' });
  }
});

// Планировщик для ежедневного обновления матрицы сходства (в 3:00 утра)
cron.schedule('0 3 * * *', async () => {
  console.log('Запуск ежедневного обновления рекомендаций...');
  try {
    await updateSimilarity();
    console.log('Обновление выполнено успешно');
  } catch (error) {
    console.error('Ошибка при плановом обновлении:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});