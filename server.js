import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import YooKassa from 'yookassa';

dotenv.config();

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
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ---------- РОУТЫ ----------

// Регистрация (с поддержкой email и реферальной ссылки)
app.post('/api/register', async (req, res) => {
  // Извлекаем все поля, включая role
  const { username, email, password, ref, role } = req.body;
  
  // Проверяем, что все обязательные поля есть
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Вставляем пользователя в базу
    const result = await pool.query(
      `INSERT INTO users (username, email, password, referred_by, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [username, email, hashedPassword, ref || null, role || 'subscriber'] // если role не указана, ставим subscriber
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      // Ошибка уникальности (пользователь уже есть)
      res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
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
      confirmation: { type: 'redirect', return_url: 'https://твой-сайт.ru/success' }, // замени на свой URL
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
      // Записываем подписку
      await pool.query(
        'INSERT INTO subscriptions (user_id, creator_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 month\')',
        [userId, creatorId]
      );

      // Получаем имена для уведомления
      const subscriberResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const creatorResult = await pool.query('SELECT name FROM creators WHERE id = $1', [creatorId]);
      const subscriberName = subscriberResult.rows[0]?.username;
      const creatorName = creatorResult.rows[0]?.name;

      // Создаём публичное уведомление
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

      // Если пользователь был приглашён по реферальной ссылке, начисляем бонус
      const userResult = await pool.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
      const referrerId = userResult.rows[0]?.referred_by;
      if (referrerId) {
        const bonus = event.object.amount.value * 0.1; // 10%
        await pool.query(
          'INSERT INTO referral_bonuses (user_id, amount, source_user_id) VALUES ($1, $2, $3)',
          [referrerId, bonus, userId]
        );
      }

      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(200);
  }
});

// Получить данные текущего пользователя (с расширенной информацией)
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    // Проверяем, является ли пользователь создателем
    const creatorResult = await pool.query('SELECT id FROM creators WHERE user_id = $1', [req.user.id]);
    const isCreator = creatorResult.rows.length > 0;
    const creatorId = isCreator ? creatorResult.rows[0].id : null;

    // Если создатель, загружаем его посты
    let posts = [];
    if (isCreator) {
      const postsResult = await pool.query('SELECT * FROM posts WHERE creator_id = $1 ORDER BY created_at DESC', [creatorId]);
      posts = postsResult.rows;
    }

    // Реферальный баланс
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

  // Проверяем, является ли пользователь создателем
  const creatorCheck = await pool.query('SELECT id FROM creators WHERE user_id = $1', [userId]);
  if (creatorCheck.rows.length === 0) {
    return res.status(403).json({ error: 'Вы не являетесь создателем' });
  }
  const creatorId = creatorCheck.rows[0].id;

  try {
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

// Получить посты текущего пользователя (для личного кабинета)
app.get('/api/user/posts', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const creatorResult = await pool.query('SELECT id FROM creators WHERE user_id = $1', [userId]);
    if (creatorResult.rows.length === 0) {
      return res.json([]); // не создатель
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

// Получить личные уведомления пользователя (включая публичные)
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

// (Опционально) Отметить уведомление как прочитанное
app.post('/api/notifications/read/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});