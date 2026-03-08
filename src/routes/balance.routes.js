
import express from 'express'
import {
  getBalance,
  getTransactions,
  requestWithdraw
} from '../controllers/balance.controller.js'

import { authenticateToken } from '../middleware/auth.middleware.js'
import { withdrawLimiter } from '../middleware/rateLimit.middleware.js'
import { validateWithdraw } from '../middleware/validation.middleware.js'

const router = express.Router()

// все маршруты требуют авторизацию
router.use(authenticateToken)

// баланс пользователя
router.get('/', getBalance)

// история транзакций
router.get('/transactions', getTransactions)

// вывод средств
router.post('/withdraw', withdrawLimiter, validateWithdraw, requestWithdraw)

export default router
