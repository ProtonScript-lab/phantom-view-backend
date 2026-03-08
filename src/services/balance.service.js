
import { pool } from '../models/db.js';
import logger from '../utils/logger.js';

export const getUserBalance = async (userId) => {
  const { rows } = await pool.query(
    `SELECT balance, frozen_balance,
            (balance - frozen_balance) as available_balance
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return rows[0] || { balance: 0, frozen_balance: 0, available_balance: 0 };
};

export const addTransaction = async (
  client,
  userId,
  type,
  amount,
  externalId = null,
  metadata = {}
) => {
  const { rows } = await client.query(
    `INSERT INTO transactions (user_id, type, amount, external_id, metadata)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [userId, type, amount, externalId, metadata]
  );

  return rows[0];
};

export const updateUserBalance = async (client, userId, delta) => {
  const { rows } = await client.query(
    `UPDATE users
     SET balance = balance + $1
     WHERE id = $2
     RETURNING balance`,
    [delta, userId]
  );

  return rows[0]?.balance;
};

export const createWithdrawRequest = async (userId, amount, wallet) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const balanceResult = await client.query(
      `SELECT balance, frozen_balance
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    const user = balanceResult.rows[0];
    const available = user.balance - user.frozen_balance;

    if (available < amount) {
      throw new Error('Недостаточно средств');
    }

    await client.query(
      `UPDATE users
       SET frozen_balance = frozen_balance + $1
       WHERE id = $2`,
      [amount, userId]
    );

    const withdraw = await client.query(
      `INSERT INTO withdraw_requests (user_id, amount, wallet, status)
       VALUES ($1,$2,$3,'pending')
       RETURNING *`,
      [userId, amount, wallet]
    );

    await client.query('COMMIT');

    logger.info('Withdraw request created', {
      userId,
      amount,
      requestId: withdraw.rows[0].id
    });

    return withdraw.rows[0];

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Withdraw request error', err);
    throw err;
  } finally {
    client.release();
  }
};

export const processWithdraw = async (requestId, adminUserId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT *
       FROM withdraw_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (!requestResult.rows.length) {
      throw new Error('Запрос не найден');
    }

    const req = requestResult.rows[0];

    if (req.status !== 'pending') {
      throw new Error('Запрос уже обработан');
    }

    const balanceUpdate = await client.query(
      `UPDATE users
       SET
         balance = balance - $1,
         frozen_balance = frozen_balance - $1
       WHERE id = $2 AND frozen_balance >= $1
       RETURNING balance`,
      [req.amount, req.user_id]
    );

    if (!balanceUpdate.rowCount) {
      throw new Error('Ошибка списания средств');
    }

    await client.query(
      `UPDATE withdraw_requests
       SET
         status = 'completed',
         processed_by = $1,
         processed_at = NOW()
       WHERE id = $2`,
      [adminUserId, requestId]
    );

    await addTransaction(
      client, req.user_id,
      'withdraw',
      -req.amount,
      null,
      { requestId }
    );

    await client.query('COMMIT');

    logger.info('Withdraw processed', {
      requestId,
      userId: req.user_id,
      amount: req.amount
    });

    return { success: true };

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Withdraw processing error', err);
    throw err;
  } finally {
    client.release();
  }
};

export const cancelWithdraw = async (requestId, adminUserId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reqResult = await client.query(
      `SELECT *
       FROM withdraw_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (!reqResult.rows.length) {
      throw new Error('Запрос не найден');
    }

    const req = reqResult.rows[0];

    if (req.status !== 'pending') {
      throw new Error('Нельзя отменить обработанный запрос');
    }

    await client.query(
      `UPDATE users
       SET frozen_balance = frozen_balance - $1
       WHERE id = $2`,
      [req.amount, req.user_id]
    );

    await client.query(
      `UPDATE withdraw_requests
       SET
         status = 'cancelled',
         processed_by = $1,
         processed_at = NOW()
       WHERE id = $2`,
      [adminUserId, requestId]
    );

    await client.query('COMMIT');

    logger.info('Withdraw cancelled', {
      requestId,
      userId: req.user_id
    });

    return { success: true };

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Withdraw cancel error', err);
    throw err;
  } finally {
    client.release();
  }
};

export const getTransactionHistory = async (userId, limit = 50) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return rows;
};