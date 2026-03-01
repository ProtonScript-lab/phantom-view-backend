import express from 'express';
import {
  generateIdeas,
  getTrends,
  enhanceText
} from '../controllers/ai.controller.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/generate-ideas', authenticateToken, generateIdeas);
router.get('/trends', authenticateToken, authorizeRole('creator'), getTrends);
router.post('/enhance', authenticateToken, enhanceText);

export default router;