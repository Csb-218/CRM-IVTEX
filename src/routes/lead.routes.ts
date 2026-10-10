import { Router } from 'express';
import { leadController } from '../controllers/lead.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';
import {
  validateCreateLead,
  validateUpdateLead,
  validateLeadStatus,
  validateLeadAssign,
  validateLeadConvert,
  validateAddNote
} from '../validators/lead.validator';
import { validateMongoId } from '../validators/user.validator';

const router = Router();

// All lead routes require authentication
router.use(authenticate);

/**
 * @route   POST /leads
 * @desc    Create lead
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateCreateLead,
  leadController.createLead
);

/**
 * @route   GET /leads
 * @desc    List with filters, search, date range (Executives only see assigned leads)
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  leadController.listLeads
);

/**
 * @route   GET /leads/:id
 * @desc    Get lead details
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  leadController.getLeadById
);

/**
 * @route   PUT /leads/:id
 * @desc    Update lead
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateUpdateLead,
  leadController.updateLead
);

/**
 * @route   PATCH /leads/:id/status
 * @desc    Change status (follows transition rules)
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.patch(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateLeadStatus,
  leadController.changeStatus
);

/**
 * @route   PATCH /leads/:id/assign
 * @desc    Assign or reassign (active executives/managers only)
 * @access  Admin, Manager (A, M)
 */
router.patch(
  '/:id/assign',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateMongoId('id'),
  validateLeadAssign,
  leadController.assignLead
);

/**
 * @route   POST /leads/:id/convert
 * @desc    Convert to customer and deal (transactional)
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.post(
  '/:id/convert',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateLeadConvert,
  leadController.convertLead
);

/**
 * @route   POST /leads/:id/notes
 * @desc    Add a note activity
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.post(
  '/:id/notes',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  validateAddNote,
  leadController.addNote
);

/**
 * @route   GET /leads/:id/activities
 * @desc    Activities on this lead
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/activities',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  leadController.getActivities
);

/**
 * @route   GET /leads/:id/timeline
 * @desc    Audit history timeline on this lead
 * @access  Admin, Manager, Executive (A, M, E)
 */
router.get(
  '/:id/timeline',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.EXECUTIVE),
  validateMongoId('id'),
  leadController.getTimeline
);

/**
 * @route   DELETE /leads/:id
 * @desc    Delete lead
 * @access  Admin only (A)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  validateMongoId('id'),
  leadController.deleteLead
);

export default router;
