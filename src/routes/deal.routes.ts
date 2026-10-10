import { Router } from 'express';
import { dealController } from '../controllers/deal.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import {
  validateCreateDeal,
  validateUpdateDeal,
  validateDealStage,
  validateDealAssign
} from '../validators/deal.validator';
import { validateMongoId } from '../validators/user.validator';

const router = Router();

// All deal routes require authentication
router.use(authenticate);

/**
 * @route   POST /deals
 * @desc    Create deal
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateCreateDeal,
  dealController.createDeal
);

/**
 * @route   GET /deals
 * @desc    List deals with filters (stage, assignee, value range, closing date)
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  dealController.listDeals
);

/**
 * @route   GET /deals/:id
 * @desc    Get deal details
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  dealController.getDealById
);

/**
 * @route   PUT /deals/:id
 * @desc    Update deal details
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateUpdateDeal,
  dealController.updateDeal
);

/**
 * @route   PATCH /deals/:id/stage
 * @desc    Move stage (lostReason required for Lost; Won/Lost cannot reopen)
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.patch(
  '/:id/stage',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateDealStage,
  dealController.moveStage
);

/**
 * @route   PATCH /deals/:id/assign
 * @desc    Reassign deal
 * @access  Admin, Manager (A, M)
 */
router.patch(
  '/:id/assign',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateMongoId('id'),
  validateDealAssign,
  dealController.assignDeal
);

/**
 * @route   GET /deals/:id/activities
 * @desc    Activities on this deal
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/activities',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  dealController.getActivities
);

/**
 * @route   GET /deals/:id/timeline
 * @desc    Audit history timeline on this deal
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/timeline',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  dealController.getTimeline
);

/**
 * @route   DELETE /deals/:id
 * @desc    Delete deal
 * @access  Admin only (A)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  dealController.deleteDeal
);

export default router;
