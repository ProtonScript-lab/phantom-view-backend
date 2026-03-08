
import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation
} from '../controllers/message.controller.js';

import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateSendMessage } from '../middleware/validation.middleware.js';
import { messageLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);

router.get('/conversations/:conversationId/messages', getMessages);

router.post('/messages', messageLimiter, validateSendMessage, sendMessage);

export default router;
