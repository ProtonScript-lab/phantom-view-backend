import * as userService from '../services/user.service.js';
import logger from '../utils/logger.js';

/**
 * Получение профиля пользователя (по id из params или текущего)
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user.id; // если id не указан, берем текущего
    const profile = await userService.getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(profile);
  } catch (err) {
    logger.error('Ошибка получения профиля:', err);
    next(err);
  }
};

/**
 * Обновление профиля (только для текущего пользователя)
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updateData = req.body; // { fullName, bio, avatarUrl, ... }
    const updated = await userService.updateUserProfile(userId, updateData);
    res.json(updated);
  } catch (err) {
    logger.error('Ошибка обновления профиля:', err);
    next(err);
  }
};

/**
 * Загрузка аватара
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    const userId = req.user.id;
    const avatarUrl = await userService.saveAvatar(userId, req.file);
    res.json({ avatarUrl });
  } catch (err) {
    logger.error('Ошибка загрузки аватара:', err);
    next(err);
  }
};

/**
 * Поиск пользователей по имени или нику
 */
export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Параметр q обязателен' });
    }
    const results = await userService.searchUsers(q);
    res.json(results);
  } catch (err) {
    logger.error('Ошибка поиска:', err);
    next(err);
  }
};

/**
 * Получение баланса пользователя
 */
export const getBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const balance = await userService.getUserBalance(userId);
    res.json({ balance });
  } catch (err) {
    logger.error('Ошибка получения баланса:', err);
    next(err);
  }
};

/**
 * История транзакций
 */
export const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const history = await userService.getTransactionHistory(userId);
    res.json(history);
  } catch (err) {
    logger.error('Ошибка получения истории:', err);
    next(err);
  }
};