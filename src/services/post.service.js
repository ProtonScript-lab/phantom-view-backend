
import { pool } from '../models/db.js';
import logger from '../utils/logger.js';

/**
 * Создание нового поста
 * @param {number} creatorId - ID создателя (из таблицы creators)
 * @param {Object} postData - данные поста { title, content, isPaid, price, media }
 * @returns {Promise<Object>} созданный пост
 */
export const createPost = async (creatorId, postData) => {
  const { title, content, isPaid = false, price = null, media = null } = postData;

  const result = await pool.query(
    `INSERT INTO posts (creator_id, title, content, is_paid, price, media)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [creatorId, title || '', content || '', isPaid, isPaid ? price : null, media]
  );

  return result.rows[0];
};

/**
 * Получение ленты постов (с пагинацией)
 * @param {number|null} userId - ID текущего пользователя (для проверки подписок)
 * @param {number} page - номер страницы
 * @param {number} limit - количество постов на странице
 * @returns {Promise<Array>} массив постов
 */
export const getFeed = async (userId = null, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `SELECT p.*, u.username, u.avatar_url
     FROM posts p
     JOIN creators c ON p.creator_id = c.id
     JOIN users u ON c.user_id = u.id
     WHERE p.is_paid = false
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
};

/**
 * Получение одного поста по ID
 * @param {number} postId
 * @param {number|null} userId - для проверки доступа (если пост платный)
 * @returns {Promise<Object|null>}
 */
export const getPostById = async (postId, userId = null) => {
  const postResult = await pool.query(
    `SELECT p.*, u.username, u.avatar_url
     FROM posts p
     JOIN creators c ON p.creator_id = c.id
     JOIN users u ON c.user_id = u.id
     WHERE p.id = $1`,
    [postId]
  );

  if (postResult.rows.length === 0) return null;

  const post = postResult.rows[0];

  if (post.is_paid) {
    if (!userId) return null;

    const subResult = await pool.query(
      `SELECT id
       FROM subscriptions
       WHERE user_id = $1
       AND creator_id = $2
       AND expires_at > NOW()`,
      [userId, post.creator_id]
    );

    if (subResult.rows.length === 0) return null;
  }

  return post;
};

/**
 * Обновление поста (только автор)
 * @param {number} postId
 * @param {number} creatorId - ID создателя (для проверки прав)
 * @param {Object} updates - поля для обновления
 * @returns {Promise<Object>} обновлённый пост
 */
export const updatePost = async (postId, creatorId, updates) => {
  const allowedFields = ['title', 'content', 'is_paid', 'price', 'media'];
  const setClause = [];
  const values = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClause.push(`${field} = $${idx}`);
      values.push(updates[field]);
      idx++;
    }
  }

  if (setClause.length === 0) {
    throw new Error('Нет данных для обновления');
  }

  values.push(postId);
  values.push(creatorId);

  const query = `
    UPDATE posts
    SET ${setClause.join(', ')}
    WHERE id = $${idx} AND creator_id = $${idx + 1}
    RETURNING *
  `;

  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    throw new Error('Пост не найден или у вас нет прав');
  }

  return result.rows[0];
};

