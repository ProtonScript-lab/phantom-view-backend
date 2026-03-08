
import { pool } from '../models/db.js'
import logger from '../utils/logger.js'

export async function updateSimilarity() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query('TRUNCATE user_subscriptions_agg')

    await client.query(`
      INSERT INTO user_subscriptions_agg
      SELECT user_id, array_agg(creator_id)
      FROM subscriptions
      GROUP BY user_id
    `)

    await client.query('TRUNCATE user_similarity')

    await client.query(`
      INSERT INTO user_similarity (user1_id, user2_id, similarity_score)
      SELECT
        a.user_id,
        b.user_id,
        (
          SELECT COUNT(*)
          FROM unnest(a.creators) x
          JOIN unnest(b.creators) y ON x = y
        )::float /
        (
          SELECT COUNT(DISTINCT c)
          FROM (
            SELECT unnest(a.creators) c
            UNION
            SELECT unnest(b.creators)
          ) u
        ) AS similarity
      FROM user_subscriptions_agg a
      JOIN user_subscriptions_agg b
        ON a.user_id < b.user_id
       AND a.creators && b.creators
    `)

    await client.query('COMMIT')

    logger.info('Similarity matrix updated')

  } catch (err) {
    await client.query('ROLLBACK')
    logger.error(err)
    throw err
  } finally {
    client.release()
  }
}

