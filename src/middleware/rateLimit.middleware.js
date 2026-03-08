
import rateLimit from 'express-rate-limit';

// лимит для обычных API запросов
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Слишком много запросов, попробуйте позже'
  }
});

// лимит для авторизации
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Слишком много попыток входа, попробуйте позже'
  }
});
