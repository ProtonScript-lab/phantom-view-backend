
import { pool } from '../models/db.js';

/**
 * Получить или создать диалог между двумя пользователями
 */
export const getOrCreateConversation = async (user1Id, user2Id) => {
  const existing = await pool.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_participants cp ON c.id = cp.conversation_id
     WHERE cp.user_id IN ($1,$2)
     GROUP BY c.id
     HAVING COUNT(DISTINCT cp.user_id) = 2
     LIMIT 1`,
    [user1Id, user2Id]
  );

  if (existing.rows.length) {
    return existing.rows[0].id;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const conv = await client.query(
      `INSERT INTO conversations DEFAULT VALUES RETURNING id`
    );

    const convId = conv.rows[0].id;

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1,$2),($1,$3)`,
      [convId, user1Id, user2Id]
    );

    await client.query('COMMIT');

    return convId;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Отправить сообщение
 */
export const sendMessage = async (
  senderId,
  conversationId,
  content,
  type = 'text',
  mediaUrl = null
) => {

  const access = await pool.query(
    `SELECT 1
     FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, senderId]
  );

  if (!access.rowCount) {
    throw new Error('Нет доступа к этому диалогу');
  }

  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, type, media_url)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [conversationId, senderId, content, type, mediaUrl]
  );

  return result.rows[0];
};

/**
 * Получить историю сообщений
 */
export const getMessages = async (
  conversationId,
  userId,
  limit = 50,
  before = null
) => {

  const participant = await pool.query(
    `SELECT 1
     FROM conversation_participants
     WHERE conversation_id=$1 AND user_id=$2`,
    [conversationId, userId]
  );

  if (!participant.rowCount) {
    throw new Error('Нет доступа к этому диалогу');
  }

  let query = `
    SELECT m.*, u.username AS sender_name, u.avatar_url
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = $1
  `;

  const params = [conversationId];

  if (before) {
    query += ` AND m.created_at < $2`;
    params.push(before);
  }

  query += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
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

      (
        SELECT json_agg(row_to_json(u))
        FROM (
          SELECT u.id, u.username, u.avatar_url
          FROM users u
          JOIN conversation_participants cp
          ON cp.user_id = u.id
          WHERE cp.conversation_id = c.id
          AND u.id != $1
        ) u
      ) AS participants,

      (
        SELECT row_to_json(m)
        FROM (
          SELECT *
          FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m
      ) AS last_message

     FROM conversations c
     JOIN conversation_participants cp
       ON cp.conversation_id = c.id
     WHERE cp.user_id = $1

     ORDER BY COALESCE(
       (
         SELECT created_at
         FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC     LIMIT 1
       ),
       c.created_at
     ) DESC`,
    [userId]
  );

  return result.rows;
};

