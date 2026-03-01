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
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
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
  // Здесь можно добавить сложную логику: если userId передан, то показывать платные посты,
  // на которые подписан пользователь, иначе только бесплатные.
  // Упрощённо: показываем все бесплатные посты
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
  // Сначала получаем пост
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

  // Если пост платный, проверяем подписку
  if (post.is_paid) {
    if (!userId) return null; // неавторизован
    // Проверяем, подписан ли пользователь на этого создателя
    const subResult = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND creator_id = $2 AND expires_at > NOW()`,
      [userId, post.creator_id]
    );
    if (subResult.rows.length === 0) return null; // нет подписки
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
      setClause.push(`${field} = $${idx++}`);
      values.push(updates[field]);
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
    WHERE id = $${idx++} AND creator_id = $${idx}
    RETURNING *
  `;
  const result = await pool.query(query, values);
  if (result.rows.length === 0) {
    throw new Error('Пост не найден или у вас нет прав');
  }
  return result.rows[0];
};

/**
 * Удаление поста (только автор)
 */
export const deletePost = async (postId, creatorId) => {
  const result = await pool.query(
    'DELETE FROM posts WHERE id = $1 AND creator_id = $2 RETURNING id',
    [postId, creatorId]
  );
  if (result.rows.length === 0) {
    throw new Error('Пост не найден или у вас нет прав');
  }
  return { id: result.rows[0].id };
};

/**
 * Лайк / дизлайк поста (toggle)
 */
export const toggleLike = async (postId, userId) => {
  // Проверяем, существует ли лайк
  const likeResult = await pool.query(
    'SELECT * FROM likes WHERE post_id = $1 AND user_id = $2',
    [postId, userId]
  );
  if (likeResult.rows.length > 0) {
    // Удаляем лайк
    await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
    return { liked: false };
  } else {
    // Добавляем лайк
    await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
    return { liked: true };
  }
};

/**
 * Добавление комментария к посту
 */
export const addComment = async (postId, userId, text) => {
  const result = await pool.query(
    `INSERT INTO comments (post_id, user_id, text)
     VALUES ($1, $2, $3) RETURNING *`,
    [postId, userId, text]
  );
  return result.rows[0];
};

/**
 * Получение комментариев к посту
 */
export const getComments = async (postId) => {
  const result = await pool.query(
    `SELECT c.*, u.username, u.avatar_url
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = $1
     ORDER BY c.created_at DESC`,
    [postId]
  );
  return result.rows;
};