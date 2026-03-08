
import express from 'express'
import {
  register,
  login,
  sendVerificationCode,
  verifyEmail
} from '../controllers/auth.controller.js'

import { authenticateToken } from '../middleware/auth.middleware.js'
import { validateRegister, validateLogin } from '../middleware/validation.middleware.js'
import { authLimiter } from '../middleware/rateLimit.middleware.js'

const router = express.Router()

// регистрация
router.post(
  '/register',
  authLimiter,
  validateRegister,
  register
)

// вход
router.post(
  '/login',
  authLimiter,
  validateLogin,
  login
)

// отправка кода подтверждения email
router.post(
  '/send-verification',
  authenticateToken,
  authLimiter,
  sendVerificationCode
)

// подтверждение email
router.post(
  '/verify-email',
  authenticateToken,
  verifyEmail
)

export default router
