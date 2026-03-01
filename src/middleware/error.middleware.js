import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Необработанная ошибка:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};