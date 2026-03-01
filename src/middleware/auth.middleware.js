import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      logger.warn('Недействительный токен:', err.message);
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user; // { id, username, role }
    next();
  });
};

export const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    next();
  };
};