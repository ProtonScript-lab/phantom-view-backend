import * as postService from '../services/post.service.js'
import logger from '../utils/logger.js'

/**
 * Создание поста (только для создателей)
 */
export const createPost = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const postData = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const newPost = await postService.createPost(userId, postData)

    return res.status(201).json(newPost)
  } catch (err) {
    logger.error('Ошибка создания поста', err)
    return next(err)
  }
}

/**
 * Получение ленты постов (с пагинацией)
 */
export const getFeed = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10

    const feed = await postService.getFeed(userId, page, limit)

    return res.json(feed)
  } catch (err) {
    logger.error('Ошибка получения ленты', err)
    return next(err)
  }
}

/**
 * Получение одного поста
 */
export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    const post = await postService.getPostById(id, userId)

    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' })
    }

    return res.json(post)
  } catch (err) {
    logger.error('Ошибка получения поста', err)
    return next(err)
  }
}

/**
 * Обновление поста (только автор)
 */
export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const updates = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const updated = await postService.updatePost(id, userId, updates)

    return res.json(updated)
  } catch (err) {
    logger.error('Ошибка обновления поста', err)
    return next(err)
  }
}

/**
 * Удаление поста (только автор)
 */
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    await postService.deletePost(id, userId)

    return res.json({ success: true })
  } catch (err) {
    logger.error('Ошибка удаления поста', err)
    return next(err)
  }
}

/**
 * Лайк или дизлайк поста
 */
export const likePost = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    const result = await postService.toggleLike(id, userId)

    return res.json(result)
  } catch (err) {
    logger.error('Ошибка лайка поста', err)
    return next(err)
  }
}

/**
 * Добавление комментария
 */
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const { text } = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Комментарий не может быть пустым' })
    }

    const comment = await postService.addComment(id, userId, text)

    return res.status(201).json(comment)
  } catch (err) {
    logger.error('Ошибка добавления комментария', err)
    return next(err)
  }
}

