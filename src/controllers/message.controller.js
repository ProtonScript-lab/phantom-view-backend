
const messageService = require('../services/message.service');

class MessageController {

  async createConversation(req, res) {
    try {
      const userId = req.user.id;
      const { otherUserId } = req.body;

      const otherId = Number(otherUserId);

      if (!otherId) {
        return res.status(400).json({ error: 'Некорректный userId' });
      }

      if (otherId === userId) {
        return res.status(400).json({ error: 'Нельзя создать диалог с самим собой' });
      }

      const conversation = await messageService.createConversation(userId, otherId);

      res.json(conversation);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка создания диалога' });
    }
  }

  async sendMessage(req, res) {
    try {
      const userId = req.user.id;
      const { conversationId, content, type = 'text', mediaUrl } = req.body;

      const convId = Number(conversationId);

      if (!convId) {
        return res.status(400).json({ error: 'Некорректный conversationId' });
      }

      if (!content && !mediaUrl) {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
      }

      const allowedTypes = ['text', 'image', 'video'];

      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ error: 'Неверный тип сообщения' });
      }

      const message = await messageService.sendMessage({
        conversationId: convId,
        senderId: userId,
        content,
        type,
        mediaUrl
      });

      res.json(message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка отправки сообщения' });
    }
  }

  async getMessages(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = Number(req.params.conversationId);

      if (!conversationId) {
        return res.status(400).json({ error: 'Некорректный conversationId' });
      }

      const { limit = 50, before } = req.query;
      const limitNum = Number(limit) || 50;

      const messages = await messageService.getMessages(
        conversationId,
        userId,
        limitNum,
        before
      );

      res.json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка получения сообщений' });
    }
  }

}

module.exports = new MessageController();
