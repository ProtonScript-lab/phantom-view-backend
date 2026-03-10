import { pool } from '../models/db.js'
import logger from '../utils/logger.js'

export const getUserBalance = async (userId) => {
  const { rows } = await pool.query(
    `SELECT
        COALESCE(balance, 0) as balance,
        COALESCE(frozen_balance, 0) as frozen_balance,
        COALESCE(balance, 0) - COALESCE(frozen_balance, 0) as available_balance
     FROM users
     WHERE id = $1`,
    [userId]
  )
  return rows[0] || { balance: 0, frozen_balance: 0, available_balance: 0 }
}

export const addTransaction = async (client, userId, type, amount, externalId = null, metadata = {}) => {
  const { rows } = await client.query(
    `INSERT INTO transactions (user_id, type, amount, external_id, metadata)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, type, amount, externalId, metadata]
  )
  return rows[0]
}

export const updateUserBalance = async (client, userId, delta) => {
  const { rows } = await client.query(
    `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
    [delta, userId]
  )
  return rows[0]?.balance
}

export const createWithdrawRequest = async (userId, amount, wallet) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const balanceResult = await client.query(
      `SELECT balance, frozen_balance FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    )
    const user = balanceResult.rows[0]
    const available = user.balance - user.frozen_balance
    if (available < amount) {
      throw new Error('Недостаточно средств')
    }

    await client.query(
      `UPDATE users SET frozen_balance = frozen_balance + $1 WHERE id = $2`,
      [amount, userId]
    )

    const withdraw = await client.query(
      `INSERT INTO withdraw_requests (user_id, amount, wallet, status)
       VALUES ($1,$2,$3,'pending') RETURNING *`,
      [userId, amount, wallet]
    )

    await client.query('COMMIT')
    logger.info('Withdraw request created', { userId, amount, requestId: withdraw.rows[0].id })
    return withdraw.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error('Withdraw request error', err)
    throw err
  } finally {
    client.release()
  }
}

export const getTransactionHistory = async (userId, limit = 50) => {
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  )
  return rows
}