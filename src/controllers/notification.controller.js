import * as notificationService from '../services/notification.service.js';
import logger from '../utils/logger.js';

/**
 * Получить публичные уведомления
 */
export const getPublicNotifications = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const notifications = await notificationService.getPublicNotifications(limit);
    res.json(notifications);
  } catch (err) {
    logger.error('Ошибка получения уведомлений:', err);
    next(err);
  }
};

/**
 * Получить личные уведомления пользователя
 */
export const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const notifications = await notificationService.getUserNotifications(userId, limit);
    res.json(notifications);
  } catch (err) {
    logger.error('Ошибка получения уведомлений пользователя:', err);
    next(err);
  }
};

/**
 * Отметить уведомление как прочитанное
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await notificationService.markAsRead(id, userId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка отметки уведомления:', err);
    next(err);
  }
};