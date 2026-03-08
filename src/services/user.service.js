
import { pool } from '../models/db.js'
import logger from '../utils/logger.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Получение профиля пользователя по ID
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
export const getUserProfile = async (userId) => {
  try {
    const userResult = await pool.query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.full_name,
        u.avatar_url,
        u.bio,
        u.balance,
        u.email_verified,
        u.created_at,
        c.id AS creator_id,
        c.price,
        c.category
      FROM users u
      LEFT JOIN creators c ON u.id = c.user_id
      WHERE u.id = $1`,
      [userId]
    )

    return userResult.rows[0] || null
  } catch (error) {
    logger.error('Ошибка получения профиля пользователя', error)
    throw error
  }
}

/**
 * Обновление профиля пользователя
 * @param {number} userId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const updateUserProfile = async (userId, data) => {
  const allowedFields = ['full_name', 'bio', 'avatar_url']
  const updates = []
  const values = []
  let index = 1

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = $${index++}`)
      values.push(data[field])
    }
  }

  if (updates.length === 0) {
    throw new Error('Нет данных для обновления')
  }

  values.push(userId)

  const query = `UPDATE users 
                 SET ${updates.join(', ')} 
                 WHERE id = $${index} 
                 RETURNING *`

  try {
    const result = await pool.query(query, values)
    return result.rows[0]
  } catch (error) {
    logger.error('Ошибка обновления профиля пользователя', error)
    throw error
  }
}

/**
 * Сохранение аватара пользователя
 * @param {number} userId
 * @param {Object} file
 * @returns {Promise<string>}
 */
export const saveAvatar = async (userId, file) => {
  try {
    const uploadDir = path.join(__dirname, '../../uploads/avatars')

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const fileName = `${userId}-${Date.now()}${path.extname(file.originalname)}`
    const destPath = path.join(uploadDir, fileName)

    await fs.promises.rename(file.path, destPath)

    const avatarUrl = `/uploads/avatars/${fileName}`

    await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, userId]
    )

    return avatarUrl
  } catch (error) {
    logger.error('Ошибка загрузки аватара', error)
    throw error
  }
}

/**
 * Поиск пользователей
 * @param {string} query
 * @returns {Promise<Array>}
 */
export const searchUsers = async (query) => {
  try {
    const searchPattern = `%${query}%`

    const result = await pool.query(
      `SELECT 
        id,
        username,
        full_name,
        avatar_url,
        role,
        bio
      FROM users
      WHERE username ILIKE $1
         OR full_name ILIKE $1
      ORDER BY
        CASE
          WHEN username ILIKE $2 THEN 0
          ELSE 1
        END,
        username
      LIMIT 20`,
      [searchPattern, query + '%']
    )

    return result.rows
  } catch (error) {
    logger.error('Ошибка поиска пользователей', error)
    throw error
  }
}
