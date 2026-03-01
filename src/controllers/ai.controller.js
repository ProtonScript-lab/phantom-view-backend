import gigachatService from '../services/gigachat.service.js';
import logger from '../utils/logger.js';

/**
 * Генерация идей для поста
 */
export const generateIdeas = async (req, res, next) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Укажите тему' });
    }
    const ideas = await gigachatService.generatePostIdeas(topic);
    res.json({ ideas });
  } catch (err) {
    logger.error('Ошибка генерации идей:', err);
    next(err);
  }
};

/**
 * Получение трендов (только для авторов)
 */
export const getTrends = async (req, res, next) => {
  try {
    const trends = await gigachatService.getTrends();
    res.json({ trends });
  } catch (err) {
    logger.error('Ошибка получения трендов:', err);
    next(err);
  }
};

/**
 * Улучшение текста
 */
export const enhanceText = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Введите текст' });
    }
    const enhanced = await gigachatService.generateText(
      `Улучши этот текст для социальных сетей: "${text}". Сделай его более цепляющим, добавь эмоций, но сохрани смысл.`
    );
    res.json({ enhanced });
  } catch (err) {
    logger.error('Ошибка улучшения текста:', err);
    next(err);
  }
};