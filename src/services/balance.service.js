import { pool } from '../models/db.js';
import logger from '../utils/logger.js';

export const getUserBalance = async (userId) => {
  const result = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.balance || 0;
};

export const addTransaction = async (userId, type, amount, externalId = null, metadata = {}) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, external_id, metadata)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, amount, externalId, metadata]
  );
  return result.rows[0];
};

export const updateUserBalance = async (userId, delta) => {
  await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [delta, userId]);
};

export const createWithdrawRequest = async (userId, amount, wallet) => {
  const balance = await getUserBalance(userId);
  if (balance < amount) {
    throw new Error('Недостаточно средств');
  }
  const result = await pool.query(
    `INSERT INTO withdraw_requests (user_id, amount, wallet)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, amount, wallet]
  );
  // Замораживаем средства? Можно сразу списать или изменить статус после одобрения
  // await updateUserBalance(userId, -amount); // если сразу списываем
  return result.rows[0];
};

export const getTransactionHistory = async (userId, limit = 50) => {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return result.rows;
};

export const processWithdraw = async (requestId, adminUserId) => {
  // Этот метод должен вызываться администратором
  const request = await pool.query('SELECT * FROM withdraw_requests WHERE id = $1', [requestId]);
  if (request.rows.length === 0) throw new Error('Запрос не найден');
  const req = request.rows[0];
  if (req.status !== 'pending') throw new Error('Запрос уже обработан');

  // Здесь можно вызвать API банка для перевода (например, ЮMoney)
  // Если перевод успешен, обновляем баланс и статус
  await pool.query('UPDATE withdraw_requests SET status = $1 WHERE id = $2', ['completed', requestId]);
  await updateUserBalance(req.user_id, -req.amount);
  await addTransaction(req.user_id, 'withdraw', -req.amount);
  return { success: true };
};