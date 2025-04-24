import express, { RequestHandler } from 'express';
import { authenticateWithToken, getProfile } from '../controllers/auth';
import { authenticate } from '../middleware/auth';
import { adminListUsers, adminTogglePremium } from '../controllers/admin';

const router = express.Router();

// Auth routes
router.post('/authenticate', authenticateWithToken as RequestHandler);
router.get('/profile', authenticate as RequestHandler, getProfile as RequestHandler);

// List all users (admin only)
router.get('/admin/users', adminListUsers as RequestHandler);
// Toggle premium for a user (admin only)
router.patch('/admin/users/:id/premium', adminTogglePremium as RequestHandler);

export default router; 