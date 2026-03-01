import * as paymentService from '../services/payment.service.js';
import logger from '../utils/logger.js';

/**
 * Создание платежа (подписка или пополнение баланса)
 */
export const createPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, creatorId, type = 'subscription' } = req.body; // type: subscription, deposit
    const paymentData = await paymentService.createPayment(userId, amount, creatorId, type);
    res.json(paymentData);
  } catch (err) {
    logger.error('Ошибка создания платежа:', err);
    next(err);
  }
};

/**
 * Webhook от YooKassa
 */
export const paymentCallback = async (req, res, next) => {
  try {
    const event = req.body;
    await paymentService.handlePaymentCallback(event);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка обработки webhook:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Запрос на вывод средств
 */
export const withdrawRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, wallet } = req.body;
    const request = await paymentService.createWithdrawRequest(userId, amount, wallet);
    res.json(request);
  } catch (err) {
    logger.error('Ошибка запроса на вывод:', err);
    next(err);
  }
};