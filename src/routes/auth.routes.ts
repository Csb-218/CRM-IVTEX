import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import {
  validateRegister,
  validateLogin,
  validateUpdateMe,
  validateChangePassword
} from '../validators/auth.validator';

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a user
 * @access  Public or Admin only
 */
router.post('/register', optionalAuthenticate, validateRegister, authController.register);

/**
 * @route   POST /auth/login
 * @desc    Login and set auth tokens & cookies
 * @access  Public
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /auth/refresh
 * @desc    Issue a new access token (using refresh token in cookie or body)
 * @access  Public (requires valid refresh token)
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /auth/logout
 * @desc    Clear auth tokens & cookies
 * @access  Logged in
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Logged in
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   PATCH /auth/me
 * @desc    Update own profile
 * @access  Logged in
 */
router.patch('/me', authenticate, validateUpdateMe, authController.updateMe);

/**
 * @route   PATCH /auth/change-password
 * @desc    Change own password
 * @access  Logged in
 */
router.patch('/change-password', authenticate, validateChangePassword, authController.changePassword);

export default router;
