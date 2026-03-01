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

router.get('/profile/:id', getUserProfile); // публичный профиль
router.put('/profile', authenticateToken, updateUserProfile); // свой профиль
router.post('/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.get('/search', searchUsers); // публичный поиск
router.get('/balance', authenticateToken, getBalance);
router.get('/transactions', authenticateToken, getTransactionHistory);

export default router;