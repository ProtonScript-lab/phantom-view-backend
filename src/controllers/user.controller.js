
import * as userService from '../services/user.service.js'
import logger from '../utils/logger.js'

/**
 * Получение профиля пользователя
 * Если id не передан — возвращается профиль текущего пользователя
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user?.id

    if (!userId) {
      return res.status(400).json({ message: 'Не указан id пользователя' })
    }

    const profile = await userService.getUserProfile(userId)

    if (!profile) {
      return res.status(404).json({ message: 'Пользователь не найден' })
    }

    return res.json(profile)
  } catch (err) {
    logger.error('Ошибка получения профиля', err)
    return next(err)
  }
}

/**
 * Обновление профиля текущего пользователя
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const updateData = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const updated = await userService.updateUserProfile(userId, updateData)

    return res.json(updated)
  } catch (err) {
    logger.error('Ошибка обновления профиля', err)
    return next(err)
  }
}

/**
 * Загрузка аватара пользователя
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' })
    }

    const avatarUrl = await userService.saveAvatar(userId, req.file)

    return res.json({ avatarUrl })
  } catch (err) {
    logger.error('Ошибка загрузки аватара', err)
    return next(err)
  }
}

/**
 * Поиск пользователей по имени или нику
 */
export const searchUsers = async (req, res, next) => {
  try {
    const query = req.query.q?.trim()

    if (!query) {
      return res.status(400).json({ message: 'Параметр q обязателен' })
    }

    const results = await userService.searchUsers(query)

    return res.json(results)
  } catch (err) {
    logger.error('Ошибка поиска пользователей', err)
    return next(err)
  }
}

/**
 * Получение баланса пользователя
 */
export const getBalance = async (req, res, next) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const balance = await userService.getUserBalance(userId)

    return res.json({ balance })
  } catch (err) {
    logger.error('Ошибка получения баланса', err)
    return next(err)
  }
}

/**
 * История транзакций пользователя
 */
export const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const history = await userService.getTransactionHistory(userId)

    return res.json(history)
  } catch (err) {
    logger.error('Ошибка получения истории транзакций', err)
    return next(err)
  }
}
