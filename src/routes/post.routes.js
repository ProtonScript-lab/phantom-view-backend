import express from 'express';
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  addComment
} from '../controllers/post.controller.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/feed', getFeed); // публичная лента
router.get('/:id', getPostById); // публичный пост
router.post('/', authenticateToken, authorizeRole('creator'), createPost);
router.put('/:id', authenticateToken, authorizeRole('creator'), updatePost);
router.delete('/:id', authenticateToken, authorizeRole('creator'), deletePost);
router.post('/:id/like', authenticateToken, likePost);
router.post('/:id/comment', authenticateToken, addComment);

export default router;