import express from 'express'
import messageController from '../controllers/message.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'

const router = express.Router()

// Все маршруты требуют аутентификации
router.use(authenticateToken)

// Получить список диалогов пользователя
router.get('/conversations', messageController.getConversations)

// Создать новый диалог (или получить существующий)
router.post('/conversations', messageController.createConversation)

// Получить сообщения конкретного диалога
router.get('/conversations/:conversationId/messages', messageController.getMessages)

// Отправить сообщение
router.post('/messages', messageController.sendMessage)

export default router