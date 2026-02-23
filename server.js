import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import YooKassa from 'yookassa-sdk';

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

// Платежи
const yooKassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY
});

app.use(cors());
app.use(express.json());

// Проверка токена
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

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password, ref } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, referred_by) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, ref || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'User already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Список создателей
app.get('/api/creators', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, bio, price, category FROM creators');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Профиль создателя + бесплатные посты
app.get('/api/creator/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const creatorResult = await pool.query('SELECT * FROM creators WHERE id = $1', [id]);
    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание платежа
app.post('/api/create-payment', authenticateToken, async (req, res) => {
  const { amount, creatorId } = req.body;
  const userId = req.user.id;
  try {
    const payment = await yooKassa.createPayment({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: 'https://твой-сайт.ru/success' }, // замени потом
      description: `Подписка на создателя #${creatorId}`,
      metadata: { userId, creatorId }
    });
    res.json({ confirmation_url: payment.confirmation.confirmation_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment creation failed' });
  }
});

// Webhook от YooKassa
app.post('/api/payment-callback', async (req, res) => {
  const event = req.body;
  if (event.event === 'payment.succeeded') {
    const { userId, creatorId } = event.object.metadata;
    try {
      await pool.query(
        'INSERT INTO subscriptions (user_id, creator_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 month\')',
        [userId, creatorId]
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
      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(200);
  }
});

// Данные текущего пользователя
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [req.user.id]);
    const postsResult = await pool.query('SELECT * FROM posts WHERE creator_id = $1', [req.user.id]);
    const bonusResult = await pool.query('SELECT SUM(amount) as total FROM referral_bonuses WHERE user_id = $1', [req.user.id]);
    res.json({
      user: userResult.rows[0],
      posts: postsResult.rows,
      referralBalance: bonusResult.rows[0]?.total || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});