import express from 'express'
import {
  getBalance,
  getTransactions,
  requestWithdraw
} from '../controllers/balance.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'

const router = express.Router()

router.use(authenticateToken)

router.get('/', getBalance)
router.get('/transactions', getTransactions)
router.post('/withdraw', requestWithdraw)

export default router