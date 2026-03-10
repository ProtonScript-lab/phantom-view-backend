import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // логируем полную ошибку
  logger.error(err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  res.status(statusCode).json({
    error: message
  });
};
