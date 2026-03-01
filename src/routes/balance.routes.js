import express from 'express';
import {
  getBalance,
  getTransactions,
  requestWithdraw
} from '../controllers/balance.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Все маршруты защищены аутентификацией
router.use(authenticateToken);

// Получить текущий баланс пользователя
router.get('/', getBalance);

// Получить историю транзакций
router.get('/transactions', getTransactions);

// Создать запрос на вывод средств
router.post('/withdraw', requestWithdraw);

export default router;