import { pool } from '../models/db.js';

/**
 * Получить или создать диалог между двумя пользователями
 */
export const getOrCreateConversation = async (user1Id, user2Id) => {
  // Проверяем, существует ли уже диалог
  const existing = await pool.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
     JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
     WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND cp1.conversation_id = cp2.conversation_id
     GROUP BY c.id HAVING COUNT(*) = 2`,
    [user1Id, user2Id]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  // Создаем новый диалог
  const result = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
  const convId = result.rows[0].id;
  await pool.query(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
    [convId, user1Id, user2Id]
  );
  return convId;
};

/**
 * Отправить сообщение
 */
export const sendMessage = async (senderId, conversationId, content, type = 'text', mediaUrl = null) => {
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, type, media_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [conversationId, senderId, content, type, mediaUrl]
  );
  return result.rows[0];
};

/**
 * Получить историю сообщений диалога
 */
export const getMessages = async (conversationId, userId, limit = 50, before = null) => {
  // Проверим, что пользователь участник
  const participant = await pool.query(
    'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  if (participant.rows.length === 0) {
    throw new Error('Нет доступа к этому диалогу');
  }
  let query = `
    SELECT m.*, u.username as sender_name, u.avatar_url
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = $1
  `;
  const params = [conversationId];
  if (before) {
    query += ' AND m.created_at < $2';
    params.push(before);
  }
  query += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Список диалогов пользователя
 */
export const getUserConversations = async (userId) => {
  const result = await pool.query(
    `SELECT 
        c.id,
        c.created_at,
        (SELECT json_agg(row_to_json(u.*)) FROM (
          SELECT u.id, u.username, u.avatar_url
          FROM users u
          JOIN conversation_participants cp ON u.id = cp.user_id
          WHERE cp.conversation_id = c.id AND u.id != $1
        ) u) as participants,
        (SELECT row_to_json(m) FROM (
          SELECT * FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
        ) m) as last_message
     FROM conversations c
     JOIN conversation_participants cp ON c.id = cp.conversation_id
     WHERE cp.user_id = $1
     ORDER BY (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) DESC`,
    [userId]
  );
  return result.rows;
};