import express from 'express';
import { 
  register, 
  login, 
  sendVerificationCode, 
  verifyEmail 
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRegister, validateLogin } from '../middleware/validation.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);

// Новые защищённые маршруты для верификации email
router.post('/send-verification', authenticateToken, sendVerificationCode);
router.post('/verify-email', authenticateToken, verifyEmail);

export default router;