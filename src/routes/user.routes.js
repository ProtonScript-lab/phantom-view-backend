import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  searchUsers,
  getBalance,
  getTransactionHistory
} from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/avatars/' });

const router = express.Router();

// Публичные маршруты
router.get('/search', searchUsers); // поиск пользователей

// Маршруты, требующие авторизации
router.get('/me', authenticateToken, getUserProfile); // данные текущего пользователя
router.put('/profile', authenticateToken, updateUserProfile); // обновление профиля
router.post('/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.get('/balance', authenticateToken, getBalance);
router.get('/transactions', authenticateToken, getTransactionHistory);

// Публичный профиль по ID (может быть и для текущего, и для других)
router.get('/profile/:id', getUserProfile);

export default router;