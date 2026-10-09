import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import {
  validateCreateUser,
  validateUpdateUser,
  validateUpdateStatus,
  validateMongoId
} from '../validators/user.validator';

const router = Router();

// Apply authentication to all user management routes
router.use(authenticate);

/**
 * @route   GET /users/assignable
 * @desc    Active executives for assignment dropdowns
 * @access  Admin (A), Manager (M)
 * @note    Must be declared before /users/:id to avoid parameter collision
 */
router.get(
  '/assignable',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  userController.getAssignableExecutives
);

/**
 * @route   POST /users
 * @desc    Create a new user
 * @access  Admin (A)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN),
  validateCreateUser,
  userController.createUser
);

/**
 * @route   GET /users
 * @desc    List users with search, role/status filter, sort, and pagination
 * @access  Admin (A)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN),
  userController.listUsers
);

/**
 * @route   GET /users/:id
 * @desc    Get user by ID
 * @access  Admin (A)
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  userController.getUserById
);

/**
 * @route   PUT /users/:id
 * @desc    Update user details
 * @access  Admin (A)
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  validateUpdateUser,
  userController.updateUser
);

/**
 * @route   PATCH /users/:id/status
 * @desc    Activate or deactivate user
 * @access  Admin (A)
 */
router.patch(
  '/:id/status',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  validateUpdateStatus,
  userController.updateUserStatus
);

/**
 * @route   DELETE /users/:id
 * @desc    Delete user (blocked if user owns records or manages team members)
 * @access  Admin (A)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  userController.deleteUser
);

export default router;
