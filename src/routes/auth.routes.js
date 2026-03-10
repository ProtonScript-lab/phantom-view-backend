import express from 'express'
import {
  register,
  login,
  sendVerificationCode,
  verifyEmail,
  verifyEmailPublic,
  resendVerification
} from '../controllers/auth.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { validateRegister, validateLogin } from '../middleware/validation.middleware.js'
import { authLimiter } from '../middleware/rateLimit.middleware.js'

const router = express.Router()

// Регистрация и вход
router.post('/register', authLimiter, validateRegister, register)
router.post('/login', authLimiter, validateLogin, login)

// Защищённые маршруты (только для авторизованных)
router.post('/send-verification', authenticateToken, authLimiter, sendVerificationCode)
router.post('/verify-email', authenticateToken, verifyEmail)

// Публичные маршруты для подтверждения email
router.post('/verify-email-public', verifyEmailPublic)
router.post('/resend-verification', resendVerification)

export default router