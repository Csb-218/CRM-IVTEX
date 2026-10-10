import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import {
  validateCreateCustomer,
  validateUpdateCustomer
} from '../validators/customer.validator';
import { validateMongoId } from '../validators/user.validator';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

/**
 * @route   POST /customers
 * @desc    Create customer directly
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateCreateCustomer,
  customerController.createCustomer
);

/**
 * @route   GET /customers
 * @desc    List customers with filters, search, date range
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  customerController.listCustomers
);

/**
 * @route   GET /customers/:id
 * @desc    Get customer with original lead
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  customerController.getCustomerById
);

/**
 * @route   PUT /customers/:id
 * @desc    Update customer
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateUpdateCustomer,
  customerController.updateCustomer
);

/**
 * @route   GET /customers/:id/deals
 * @desc    Deals of this customer
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/deals',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  customerController.getCustomerDeals
);

/**
 * @route   GET /customers/:id/activities
 * @desc    Activities on this customer
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/activities',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  customerController.getActivities
);

/**
 * @route   GET /customers/:id/timeline
 * @desc    Audit history timeline on this customer
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/timeline',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  customerController.getTimeline
);

/**
 * @route   DELETE /customers/:id
 * @desc    Delete customer (blocked if open deals exist)
 * @access  Admin only (A)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  customerController.deleteCustomer
);

export default router;
