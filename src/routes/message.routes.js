import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation
} from '../controllers/message.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken); // все роуты мессенджера требуют авторизации

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);

export default router;