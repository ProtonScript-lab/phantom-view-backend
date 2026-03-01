import { pool } from '../models/db.js';
import logger from '../utils/logger.js';
import YooKassa from 'yookassa';
import { config } from '../config/env.js';

// Инициализация YooKassa
const yooKassa = new YooKassa({
  shopId: config.yooKassa.shopId,
  secretKey: config.yooKassa.secretKey
});

/**
 * Создание платежа (подписка или пополнение баланса)
 * @param {number} userId - ID пользователя
 * @param {number} amount - сумма в рублях
 * @param {number|null} creatorId - ID создателя (для подписки)
 * @param {string} type - тип платежа: 'subscription' или 'deposit'
 * @returns {Promise<Object>} объект с confirmation_url и payment_id
 */
export const createPayment = async (userId, amount, creatorId = null, type = 'subscription') => {
  try {
    const description = type === 'subscription'
      ? `Подписка на создателя #${creatorId}`
      : `Пополнение баланса Phantom View`;

    const metadata = { userId, creatorId, type };

    const payment = await yooKassa.createPayment({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: {
        type: 'redirect',
        return_url: `${config.frontendUrl}/payment-success` // измените на свой URL
      },
      description,
      metadata
    });

    // Сохраняем транзакцию в БД со статусом pending
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, external_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, amount * 100, 'pending', payment.id, metadata] // конвертируем рубли в копейки
    );

    return {
      confirmation_url: payment.confirmation.confirmation_url,
      payment_id: payment.id
    };
  } catch (err) {
    logger.error('Ошибка создания платежа в YooKassa:', err);
    throw new Error('Не удалось создать платёж');
  }
};

/**
 * Обработка webhook-уведомления от YooKassa
 * @param {Object} event - тело уведомления
 */
export const handlePaymentCallback = async (event) => {
  // Нас интересует только успешная оплата
  if (event.event !== 'payment.succeeded') return;

  const { object } = event;
  const { userId, creatorId, type } = object.metadata;

  try {
    await pool.query('BEGIN');

    // Обновляем статус транзакции
    await pool.query(
      `UPDATE transactions SET status = 'completed' WHERE external_id = $1`,
      [object.id]
    );

    if (type === 'subscription') {
      // Создаём подписку на 1 месяц
      await pool.query(
        `INSERT INTO subscriptions (user_id, creator_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 month')`,
        [userId, creatorId]
      );

      // Создаём уведомление о подписке
      const subscriberResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const creatorResult = await pool.query('SELECT name FROM creators WHERE id = $1', [creatorId]);
      const notificationData = {
        subscriberId: userId,
        creatorId,
        subscriberName: subscriberResult.rows[0]?.username,
        creatorName: creatorResult.rows[0]?.name
      };
      await pool.query(
        `INSERT INTO notifications (user_id, type, data) VALUES (NULL, 'subscription', $1)`,
        [notificationData]
      );

      // Если пользователь был приглашён, начисляем реферальный бонус
      const userResult = await pool.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
      const referrerId = userResult.rows[0]?.referred_by;
      if (referrerId) {
        const bonus = object.amount.value * 0.1; // 10% от суммы в рублях
        await pool.query(
          `INSERT INTO referral_bonuses (user_id, amount, source_user_id) VALUES ($1, $2, $3)`,
          [referrerId, bonus * 100, userId] // бонус в копейках
        );
      }
    } else if (type === 'deposit') {
      // Пополнение баланса (сумма уже в копейках в транзакции)
      await pool.query(
        `UPDATE users SET balance = balance + $1 WHERE id = $2`,
        [object.amount.value * 100, userId]
      );
    }

    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    logger.error('Ошибка обработки успешного платежа:', err);
    throw err;
  }
};

/**
 * Создание заявки на вывод средств
 * @param {number} userId
 * @param {number} amount - сумма в рублях
 * @param {string} wallet - реквизиты для вывода (карта, кошелёк)
 * @returns {Promise<Object>} созданная заявка
 */
export const createWithdrawRequest = async (userId, amount, wallet) => {
  const amountInKopecks = amount * 100;

  // Проверяем баланс
  const balanceResult = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
  const balance = balanceResult.rows[0]?.balance || 0;
  if (balance < amountInKopecks) {
    throw new Error('Недостаточно средств');
  }

  // Создаём запрос
  const result = await pool.query(
    `INSERT INTO withdraw_requests (user_id, amount, wallet, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [userId, amountInKopecks, wallet]
  );

  // Здесь можно либо сразу списать средства, либо ждать подтверждения админа.
  // Пока оставляем баланс без изменений.

  return result.rows[0];
};