import express from 'express';
import {
  getPublicNotifications,
  getUserNotifications,
  markAsRead
} from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/public', getPublicNotifications);
router.get('/me', authenticateToken, getUserNotifications);
router.post('/:id/read', authenticateToken, markAsRead);

export default router;