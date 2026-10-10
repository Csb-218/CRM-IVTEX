import { Router } from 'express';
import { timelineController } from '../controllers/timeline.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import { validateQueryTimeline } from '../validators/timeline.validator';

const router = Router();

// All timeline routes require authentication
router.use(authenticate);

/**
 * @route   GET /timeline
 * @desc    Query timeline logs by entityType, entityId, action, date range
 * @access  Admin, Manager (A, M)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateQueryTimeline,
  timelineController.getTimeline
);

export default router;
