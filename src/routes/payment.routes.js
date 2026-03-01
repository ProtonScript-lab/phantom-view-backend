import express from 'express';
import {
  createPayment,
  paymentCallback,
  withdrawRequest
} from '../controllers/payment.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/create', authenticateToken, createPayment);
router.post('/callback', paymentCallback); // публичный webhook
router.post('/withdraw', authenticateToken, withdrawRequest);

export default router;