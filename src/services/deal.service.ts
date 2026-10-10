import { Types } from 'mongoose';
import {
  Deal,
  IDeal,
  DealStage,
  Customer,
  User,
  UserRole,
  IUser,
  Activity,
  EntityType,
  Timeline,
  TimelineAction
} from '../models';
import { AppError } from '../utils/appError';
import { logTimeline } from '../utils/auditLogger';

export interface CreateDealInput {
  name: string;
  customerId: string | Types.ObjectId;
  leadId?: string | Types.ObjectId | null;
  assignedTo?: string | Types.ObjectId | null;
  value: number;
  probability?: number;
  expectedCloseDate?: string | Date | null;
  stage?: DealStage;
  description?: string;
}

export interface UpdateDealInput {
  name?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string | Date | null;
  description?: string;
}

export interface ListDealsQuery {
  search?: string;
  stage?: DealStage;
  assignedTo?: string;
  customerId?: string;
  minValue?: string | number;
  maxValue?: string | number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export class DealService {
  /**
   * Helper to check executive access to deal
   */
  private checkAccess(deal: IDeal, user: IUser) {
    if (user.role === UserRole.EXECUTIVE) {
      if (!deal.assignedTo || deal.assignedTo.toString() !== user._id.toString()) {
        throw new AppError('Forbidden: Executives can only view or manage deals assigned to them', 403);
      }
    }
  }

  /**
   * Create deal (Access: A, M, E)
   */
  async createDeal(input: CreateDealInput, user: IUser): Promise<IDeal> {
    const customer = await Customer.findById(input.customerId);
    if (!customer) {
      throw new AppError(`Customer with ID '${input.customerId}' not found`, 404);
    }

    if (input.value <= 0) {
      throw new AppError('Deal value must be greater than 0', 400);
    }

    const probability = input.probability !== undefined ? input.probability : 20;
    if (probability < 0 || probability > 100) {
      throw new AppError('Probability must be between 0 and 100', 400);
    }

    let assignedUserId: Types.ObjectId;
    if (input.assignedTo) {
      const assignee = await User.findById(input.assignedTo);
      if (!assignee || !assignee.isActive) {
        throw new AppError('Assigned user not found or inactive', 400);
      }
      assignedUserId = new Types.ObjectId(input.assignedTo.toString());
    } else if (user.role === UserRole.EXECUTIVE) {
      assignedUserId = user._id;
    } else {
      assignedUserId = customer.assignedTo || user._id;
    }

    const expectedRevenue = Math.round(input.value * (probability / 100) * 100) / 100;

    const deal = await Deal.create({
      ...input,
      customerId: customer._id,
      assignedTo: assignedUserId,
      probability,
      expectedRevenue,
      stage: input.stage || DealStage.QUALIFICATION
    });

    await logTimeline({
      entityType: EntityType.DEAL,
      entityId: deal._id,
      action: TimelineAction.CREATED,
      performedBy: user._id,
      newValue: { value: deal.value, stage: deal.stage, assignedTo: assignedUserId },
      description: `Deal '${deal.name}' created by ${user.name}`
    });

    return (await Deal.findById(deal._id)
      .populate('customerId', 'name email company')
      .populate('assignedTo', 'name email role')) as IDeal;
  }

  /**
   * List deals with filters, range queries, and pagination (Access: A, M, E)
   */
  async listDeals(query: ListDealsQuery, user: IUser) {
    const filter: Record<string, any> = {};

    if (user.role === UserRole.EXECUTIVE) {
      filter.assignedTo = user._id;
    } else if (query.assignedTo && Types.ObjectId.isValid(query.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }

    if (query.customerId && Types.ObjectId.isValid(query.customerId)) {
      filter.customerId = new Types.ObjectId(query.customerId);
    }

    if (query.search && query.search.trim().length > 0) {
      filter.name = new RegExp(query.search.trim(), 'i');
    }

    if (query.stage && Object.values(DealStage).includes(query.stage)) {
      filter.stage = query.stage;
    }

    // Min/Max Value filter
    if (query.minValue !== undefined || query.maxValue !== undefined) {
      filter.value = {};
      if (query.minValue !== undefined && !isNaN(Number(query.minValue))) {
        filter.value.$gte = Number(query.minValue);
      }
      if (query.maxValue !== undefined && !isNaN(Number(query.maxValue))) {
        filter.value.$lte = Number(query.maxValue);
      }
    }

    // Closing date range filter
    if (query.startDate || query.endDate) {
      filter.expectedCloseDate = {};
      if (query.startDate) filter.expectedCloseDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.expectedCloseDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'value', 'expectedRevenue', 'expectedCloseDate', 'stage'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [deals, total] = await Promise.all([
      Deal.find(filter)
        .populate('customerId', 'name email company')
        .populate('assignedTo', 'name email role')
        .populate('leadId', 'name status source')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Deal.countDocuments(filter)
    ]);

    return {
      deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get single deal by ID (Access: A, M, E)
   */
  async getDealById(id: string, user: IUser): Promise<IDeal> {
    const deal = await Deal.findById(id)
      .populate('customerId', 'name email phone company address')
      .populate('assignedTo', 'name email role phone')
      .populate('leadId', 'name status source');

    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    this.checkAccess(deal, user);
    return deal;
  }

  /**
   * Update deal details (Access: A, M, E)
   */
  async updateDeal(id: string, input: UpdateDealInput, user: IUser): Promise<IDeal> {
    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    this.checkAccess(deal, user);

    if (input.value !== undefined) {
      if (input.value <= 0) {
        throw new AppError('Deal value must be greater than 0', 400);
      }
      deal.value = input.value;
    }

    if (input.probability !== undefined) {
      if (input.probability < 0 || input.probability > 100) {
        throw new AppError('Probability must be between 0 and 100', 400);
      }
      deal.probability = input.probability;
    }

    // Recalculate expected revenue: value x probability
    deal.expectedRevenue = Math.round(deal.value * (deal.probability / 100) * 100) / 100;

    if (input.name !== undefined) deal.name = input.name.trim();
    if (input.expectedCloseDate !== undefined) {
      deal.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : null;
    }
    if (input.description !== undefined) deal.description = input.description.trim();

    await deal.save();

    return (await Deal.findById(id)
      .populate('customerId', 'name email company')
      .populate('assignedTo', 'name email role')) as IDeal;
  }

  /**
   * Move deal stage with strict business rules (Access: A, M, E)
   * Rules:
   * 1. Won and Lost deals can't move back to an active stage.
   * 2. Lost requires a reason, and the closing date must be valid.
   */
  async moveStage(
    id: string,
    newStage: DealStage,
    lostReason?: string,
    expectedCloseDate?: string | Date,
    user?: IUser
  ): Promise<IDeal> {
    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    if (user) {
      this.checkAccess(deal, user);
    }

    const previousStage = deal.stage;

    // Rule 1: Won and Lost deals can't move back to an active stage
    if ([DealStage.WON, DealStage.LOST].includes(previousStage)) {
      throw new AppError(
        `Closed deals (${previousStage.toUpperCase()}) cannot be moved back to an active stage`,
        400
      );
    }

    // Rule 2: Lost requires a reason, and the closing date must be valid
    if (newStage === DealStage.LOST) {
      if (!lostReason || typeof lostReason !== 'string' || lostReason.trim().length === 0) {
        throw new AppError("Field 'lostReason' is required when moving a deal to 'lost'", 400);
      }
      deal.lostReason = lostReason.trim();
      deal.probability = 0;
      deal.closedAt = new Date();
    } else if (newStage === DealStage.WON) {
      deal.lostReason = null;
      deal.probability = 100;
      deal.closedAt = new Date();
    } else {
      deal.lostReason = null;
      deal.closedAt = null;
    }

    if (expectedCloseDate) {
      deal.expectedCloseDate = new Date(expectedCloseDate);
    }

    deal.stage = newStage;
    deal.expectedRevenue = Math.round(deal.value * (deal.probability / 100) * 100) / 100;

    await deal.save();

    if (user) {
      await logTimeline({
        entityType: EntityType.DEAL,
        entityId: deal._id,
        action: TimelineAction.STAGE_CHANGED,
        performedBy: user._id,
        previousValue: previousStage,
        newValue: newStage,
        description: `Deal stage moved from '${previousStage}' to '${newStage}' by ${user.name}${
          newStage === DealStage.LOST ? ` (Reason: ${lostReason})` : ''
        }`
      });
    }

    return (await Deal.findById(id)
      .populate('customerId', 'name email company')
      .populate('assignedTo', 'name email role')) as IDeal;
  }

  /**
   * Reassign deal (Access: A, M)
   */
  async assignDeal(id: string, assignedToId: string, user: IUser): Promise<IDeal> {
    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    const assignee = await User.findById(assignedToId);
    if (!assignee || !assignee.isActive) {
      throw new AppError('Assigned user not found or inactive', 400);
    }

    const previousAssigneeId = deal.assignedTo;
    deal.assignedTo = assignee._id;
    await deal.save();

    await logTimeline({
      entityType: EntityType.DEAL,
      entityId: deal._id,
      action: TimelineAction.ASSIGNED,
      performedBy: user._id,
      previousValue: previousAssigneeId,
      newValue: assignee._id,
      description: `Deal reassigned to ${assignee.name} (${assignee.role}) by ${user.name}`
    });

    return (await Deal.findById(id)
      .populate('customerId', 'name email company')
      .populate('assignedTo', 'name email role')) as IDeal;
  }

  /**
   * Get activities on this deal (Access: A, M, E)
   */
  async getActivities(id: string, user: IUser) {
    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    this.checkAccess(deal, user);

    return await Activity.find({
      entityType: EntityType.DEAL,
      entityId: deal._id
    })
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Get timeline audit history on this deal (Access: A, M, E)
   */
  async getTimeline(id: string, user: IUser) {
    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    this.checkAccess(deal, user);

    return await Timeline.find({
      entityType: EntityType.DEAL,
      entityId: deal._id
    })
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Delete deal (Access: Admin only)
   */
  async deleteDeal(id: string): Promise<void> {
    const deal = await Deal.findById(id);
    if (!deal) {
      throw new AppError(`Deal with ID '${id}' not found`, 404);
    }

    await Promise.all([
      Deal.findByIdAndDelete(id),
      Activity.deleteMany({ entityType: EntityType.DEAL, entityId: id }),
      Timeline.deleteMany({ entityType: EntityType.DEAL, entityId: id })
    ]);
  }
}

export const dealService = new DealService();
export default dealService;
