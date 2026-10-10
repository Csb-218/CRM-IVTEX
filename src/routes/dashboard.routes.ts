import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import { validateDashboardQuery } from '../validators/dashboard.validator';

const router = Router();

// All dashboard endpoints require authentication
router.use(authenticate);

/**
 * @route   GET /dashboard/summary
 * @desc    Lead, customer, deal, revenue, and activity metrics, plus conversion rate
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/summary',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateDashboardQuery,
  dashboardController.getSummary
);

/**
 * @route   GET /dashboard/pipeline
 * @desc    Deal count and value per stage
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/pipeline',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateDashboardQuery,
  dashboardController.getPipeline
);

/**
 * @route   GET /dashboard/team-performance
 * @desc    Per-executive leads, conversions, revenue
 * @access  Admin, Manager (A, M)
 */
router.get(
  '/team-performance',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateDashboardQuery,
  dashboardController.getTeamPerformance
);

/**
 * @route   GET /dashboard/lead-sources
 * @desc    Lead count and conversion by source (optional)
 * @access  Admin, Manager (A, M)
 */
router.get(
  '/lead-sources',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateDashboardQuery,
  dashboardController.getLeadSources
);

export default router;
