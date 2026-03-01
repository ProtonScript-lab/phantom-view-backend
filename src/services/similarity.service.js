import { pool } from '../models/db.js';
import logger from '../utils/logger.js';

export async function updateSimilarity() {
  await pool.query('TRUNCATE user_similarity');
  await pool.query(`
    INSERT INTO user_similarity (user1_id, user2_id, similarity_score)
    WITH subscriptions_agg AS (
      SELECT user_id, array_agg(creator_id) as creators
      FROM subscriptions
      GROUP BY user_id
    )
    SELECT 
      a.user_id AS user1_id,
      b.user_id AS user2_id,
      CAST(ARRAY_LENGTH(a.creators & b.creators, 1) AS FLOAT) / 
      CAST(ARRAY_LENGTH(a.creators | b.creators, 1) AS FLOAT) AS similarity
    FROM subscriptions_agg a
    JOIN subscriptions_agg b ON a.user_id < b.user_id
    WHERE ARRAY_LENGTH(a.creators, 1) > 0 
      AND ARRAY_LENGTH(b.creators, 1) > 0
  `);
  logger.info('Матрица сходства обновлена');
}