import { pool } from '../models/db.js'
import logger from '../utils/logger.js'

export async function updateSimilarity() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query('TRUNCATE user_similarity')

    await client.query(`
      INSERT INTO user_similarity (user1_id, user2_id, similarity_score)
      WITH subscriptions_agg AS (
        SELECT user_id, array_agg(creator_id) AS creators
        FROM subscriptions
        GROUP BY user_id
      )
      SELECT
        a.user_id AS user1_id,
        b.user_id AS user2_id,
        (
          SELECT COUNT(*)
          FROM unnest(a.creators) x
          JOIN unnest(b.creators) y ON x = y
        )::float /
        NULLIF(
          (
            SELECT COUNT(DISTINCT c)
            FROM (
              SELECT unnest(a.creators) AS c
              UNION
              SELECT unnest(b.creators)
            ) u
          ), 0
        ) AS similarity
      FROM subscriptions_agg a
      JOIN subscriptions_agg b ON a.user_id < b.user_id
      WHERE array_length(a.creators, 1) > 0
        AND array_length(b.creators, 1) > 0
        AND (
          SELECT COUNT(*)
          FROM unnest(a.creators) x
          JOIN unnest(b.creators) y ON x = y
        ) > 0
    `)

    await client.query('COMMIT')
    logger.info('Similarity matrix updated successfully')
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error('Error updating similarity matrix', err)
    throw err
  } finally {
    client.release()
  }
}