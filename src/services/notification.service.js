import { pool } from '../models/db.js';
import logger from '../utils/logger.js';

/**
 * Получить публичные уведомления (для всех пользователей)
 * @param {number} limit - максимальное количество уведомлений
 * @returns {Promise<Array>} массив уведомлений
 */
export const getPublicNotifications = async (limit = 10) => {
  const result = await pool.query(
    `SELECT * FROM notifications 
     WHERE user_id IS NULL 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

/**
 * Получить личные уведомления пользователя (включая публичные)
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export const getUserNotifications = async (userId, limit = 10) => {
  const result = await pool.query(
    `SELECT * FROM notifications 
     WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC 
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

/**
 * Отметить уведомление как прочитанное (только для личных уведомлений)
 * @param {number} notificationId
 * @param {number} userId - для проверки прав
 * @returns {Promise<boolean>}
 */
export const markAsRead = async (notificationId, userId) => {
  const result = await pool.query(
    `UPDATE notifications 
     SET is_read = true 
     WHERE id = $1 AND user_id = $2 
     RETURNING id`,
    [notificationId, userId]
  );
  return result.rows.length > 0;
};

/**
 * Создать новое уведомление
 * @param {number|null} userId - кому адресовано (null = публичное)
 * @param {string} type - тип уведомления (например, 'subscription')
 * @param {Object} data - данные уведомления (JSONB)
 * @returns {Promise<Object>} созданное уведомление
 */
export const createNotification = async (userId, type, data) => {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, data)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, type, data]
  );
  return result.rows[0];
};