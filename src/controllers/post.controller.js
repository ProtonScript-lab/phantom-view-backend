import * as postService from '../services/post.service.js';
import logger from '../utils/logger.js';

/**
 * Создание поста (только для создателей)
 */
export const createPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const postData = req.body; // { title, content, isPaid, price, media }
    const newPost = await postService.createPost(userId, postData);
    res.status(201).json(newPost);
  } catch (err) {
    logger.error('Ошибка создания поста:', err);
    next(err);
  }
};

/**
 * Получение ленты постов (с пагинацией)
 */
export const getFeed = async (req, res, next) => {
  try {
    const userId = req.user?.id; // может быть неавторизован
    const { page = 1, limit = 10 } = req.query;
    const feed = await postService.getFeed(userId, page, limit);
    res.json(feed);
  } catch (err) {
    logger.error('Ошибка получения ленты:', err);
    next(err);
  }
};

/**
 * Получение одного поста
 */
export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const post = await postService.getPostById(id, userId);
    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' });
    }
    res.json(post);
  } catch (err) {
    logger.error('Ошибка получения поста:', err);
    next(err);
  }
};

/**
 * Обновление поста (только автор)
 */
export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;
    const updated = await postService.updatePost(id, userId, updates);
    res.json(updated);
  } catch (err) {
    logger.error('Ошибка обновления поста:', err);
    next(err);
  }
};

/**
 * Удаление поста (только автор)
 */
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await postService.deletePost(id, userId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка удаления поста:', err);
    next(err);
  }
};

/**
 * Лайк / дизлайк поста
 */
export const likePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await postService.toggleLike(id, userId);
    res.json(result);
  } catch (err) {
    logger.error('Ошибка лайка:', err);
    next(err);
  }
};

/**
 * Добавление комментария
 */
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { text } = req.body;
    const comment = await postService.addComment(id, userId, text);
    res.status(201).json(comment);
  } catch (err) {
    logger.error('Ошибка добавления комментария:', err);
    next(err);
  }
};