import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import {
  validateCreateActivity,
  validateUpdateActivity
} from '../validators/activity.validator';
import { validateMongoId } from '../validators/user.validator';

const router = Router();

// All activity routes require authentication
router.use(authenticate);

/**
 * @route   POST /activities
 * @desc    Create activity or follow-up
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateCreateActivity,
  activityController.createActivity
);

/**
 * @route   GET /activities
 * @desc    List activities (type, status, overdue, assignee, due range)
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  activityController.listActivities
);

/**
 * @route   GET /activities/:id
 * @desc    Get activity
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  activityController.getActivityById
);

/**
 * @route   PUT /activities/:id
 * @desc    Update activity
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateUpdateActivity,
  activityController.updateActivity
);

/**
 * @route   PATCH /activities/:id/complete
 * @desc    Mark activity completed
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.patch(
  '/:id/complete',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  activityController.completeActivity
);

/**
 * @route   DELETE /activities/:id
 * @desc    Delete activity (Admins and Managers can delete any, Executives can only delete their own)
 * @access  Admin, Manager, Creator (A, M, creator)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  activityController.deleteActivity
);

export default router;
