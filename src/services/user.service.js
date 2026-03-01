import { pool } from '../models/db.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Получение профиля пользователя по ID
 * @param {number} userId
 * @returns {Promise<Object|null>} Объект пользователя (объединённый с данными создателя, если есть)
 */
export const getUserProfile = async (userId) => {
  const userResult = await pool.query(
    `SELECT u.id, u.username, u.email, u.role, u.full_name, u.avatar_url, u.bio, u.balance,
            u.email_verified, u.created_at,
            c.id as creator_id, c.price, c.category
     FROM users u
     LEFT JOIN creators c ON u.id = c.user_id
     WHERE u.id = $1`,
    [userId]
  );
  return userResult.rows[0] || null;
};

/**
 * Обновление профиля пользователя
 * @param {number} userId
 * @param {Object} data - поля для обновления (full_name, bio, avatar_url и т.д.)
 * @returns {Promise<Object>} Обновлённые данные
 */
export const updateUserProfile = async (userId, data) => {
  // Динамически строим запрос, чтобы обновить только переданные поля
  const allowedFields = ['full_name', 'bio', 'avatar_url'];
  const updates = [];
  const values = [];
  let index = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = $${index++}`);
      values.push(data[field]);
    }
  }

  if (updates.length === 0) {
    throw new Error('Нет данных для обновления');
  }

  values.push(userId);
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${index} RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Сохранение аватара пользователя (загрузка файла)
 * @param {number} userId
 * @param {Object} file - объект файла от multer (содержит path, filename)
 * @returns {Promise<string>} URL аватара
 */
export const saveAvatar = async (userId, file) => {
  // Здесь можно переместить файл в нужную папку и сгенерировать URL
  // Например, сохраняем файл в public/uploads/avatars/
  const uploadDir = path.join(__dirname, '../../uploads/avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `${userId}-${Date.now()}${path.extname(file.originalname)}`;
  const destPath = path.join(uploadDir, fileName);
  fs.renameSync(file.path, destPath);

  // URL для доступа к файлу (нужно настроить статическую раздачу в app.js)
  const avatarUrl = `/uploads/avatars/${fileName}`;

  // Обновляем запись в БД
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);

  return avatarUrl;
};

/**
 * Поиск пользователей по имени или нику
 * @param {string} query - поисковый запрос
 * @returns {Promise<Array>} Массив пользователей (id, username, full_name, avatar_url, role)
 */
export const searchUsers = async (query) => {
  const searchPattern = `%${query}%`;
  const result = await pool.query(
    `SELECT id, username, full_name, avatar_url, role, bio
     FROM users
     WHERE username ILIKE $1 OR full_name ILIKE $1
     ORDER BY 
       CASE 
         WHEN username ILIKE $2 THEN 0  -- точное совпадение с начала
         ELSE 1
       END,
       username
     LIMIT 20`,
    [searchPattern, query + '%']
  );
  return result.rows;
};

/**
 * Получение баланса пользователя
 * @param {number} userId
 * @returns {Promise<number>} Баланс в копейках (или рублях, зависит от типа)
 */
export const getUserBalance = async (userId) => {
  const result = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.balance || 0;
};

/**
 * История транзакций пользователя
 * @param {number} userId
 * @param {number} limit - максимум записей (по умолчанию 50)
 * @returns {Promise<Array>} Список транзакций
 */
export const getTransactionHistory = async (userId, limit = 50) => {
  const result = await pool.query(
    `SELECT id, type, amount, status, external_id, metadata, created_at
     FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};