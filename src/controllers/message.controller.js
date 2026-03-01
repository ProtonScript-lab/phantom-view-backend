import * as messageService from '../services/message.service.js';
import logger from '../utils/logger.js';

export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversations = await messageService.getUserConversations(userId);
    res.json(conversations);
  } catch (err) {
    logger.error('Ошибка получения диалогов:', err);
    next(err);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const messages = await messageService.getMessages(conversationId, userId, parseInt(limit), before);
    res.json(messages);
  } catch (err) {
    if (err.message === 'Нет доступа к этому диалогу') {
      return res.status(403).json({ error: err.message });
    }
    logger.error('Ошибка получения сообщений:', err);
    next(err);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId, content, type, mediaUrl } = req.body;
    if (!conversationId) {
      return res.status(400).json({ error: 'Не указан conversationId' });
    }
    const message = await messageService.sendMessage(userId, conversationId, content, type, mediaUrl);
    res.status(201).json(message);
  } catch (err) {
    logger.error('Ошибка отправки сообщения:', err);
    next(err);
  }
};

export const createConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.body;
    if (!otherUserId) {
      return res.status(400).json({ error: 'Не указан otherUserId' });
    }
    const conversationId = await messageService.getOrCreateConversation(userId, otherUserId);
    res.json({ conversationId });
  } catch (err) {
    logger.error('Ошибка создания диалога:', err);
    next(err);
  }
};