import * as balanceService from '../services/balance.service.js';
import logger from '../utils/logger.js';

export const getBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const balance = await balanceService.getUserBalance(userId);
    res.json({ balance });
  } catch (err) {
    logger.error('Ошибка получения баланса:', err);
    next(err);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const history = await balanceService.getTransactionHistory(userId);
    res.json(history);
  } catch (err) {
    logger.error('Ошибка получения истории:', err);
    next(err);
  }
};

export const requestWithdraw = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, wallet } = req.body;
    const request = await balanceService.createWithdrawRequest(userId, amount, wallet);
    res.json(request);
  } catch (err) {
    if (err.message === 'Недостаточно средств') {
      return res.status(400).json({ error: err.message });
    }
    logger.error('Ошибка запроса на вывод:', err);
    next(err);
  }
};