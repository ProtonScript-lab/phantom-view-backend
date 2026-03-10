import * as notificationService from '../services/notification.service.js'
import logger from '../utils/logger.js'

/**
 * Получить публичные уведомления
 */
export const getPublicNotifications = async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 10

    const notifications = await notificationService.getPublicNotifications(limit)

    return res.json(notifications)
  } catch (err) {
    logger.error('Ошибка получения публичных уведомлений', err)
    return next(err)
  }
}

/**
 * Получить личные уведомления пользователя
 */
export const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const limit = Number.parseInt(req.query.limit, 10) || 10

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const notifications = await notificationService.getUserNotifications(userId, limit)

    return res.json(notifications)
  } catch (err) {
    logger.error('Ошибка получения уведомлений пользователя', err)
    return next(err)
  }
}

/**
 * Отметить уведомление как прочитанное
 */
export const markAsRead = async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id)
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    if (!notificationId) {
      return res.status(400).json({ message: 'Некорректный id уведомления' })
    }

    await notificationService.markAsRead(notificationId, userId)

    return res.json({ success: true })
  } catch (err) {
    logger.error('Ошибка отметки уведомления как прочитанного', err)
    return next(err)
  }
}
