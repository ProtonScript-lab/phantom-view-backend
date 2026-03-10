import express from 'express';
import {
  generateIdeas,
  getTrends,
  enhanceText
} from '../controllers/ai.controller.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Генерация идей
router.post(
  '/generate-ideas',
  authenticateToken,
  generateIdeas
);

// Получение трендов (только для creator)
router.get(
  '/trends',
  authenticateToken,
  authorizeRole('creator'),
  getTrends
);

// Улучшение текста
router.post(
  '/enhance',
  authenticateToken,
  enhanceText
);

export default router;
