import { Types } from 'mongoose';
import {
  Activity,
  IActivity,
  ActivityType,
  ActivityStatus,
  EntityType
} from '../models/activity.model';
import { User, IUser, UserRole } from '../models/user.model';
import { Lead } from '../models/lead.model';
import { Customer } from '../models/customer.model';
import { Deal } from '../models/deal.model';
import { AppError } from '../utils/appError';
import { logTimeline } from '../utils/auditLogger';
import { TimelineAction } from '../models/timeline.model';

export interface CreateActivityInput {
  type: ActivityType;
  title?: string;
  description?: string;
  content?: string;
  entityType: EntityType;
  entityId: string | Types.ObjectId;
  assignedTo?: string | Types.ObjectId | null;
  dueDate?: string | Date | null;
  status?: ActivityStatus;
}

export interface UpdateActivityInput {
  type?: ActivityType;
  title?: string;
  description?: string;
  content?: string;
  assignedTo?: string | Types.ObjectId | null;
  dueDate?: string | Date | null;
  status?: ActivityStatus;
}

export interface ListActivitiesQuery {
  type?: ActivityType;
  status?: ActivityStatus;
  overdue?: string | boolean;
  assignedTo?: string;
  assignee?: string;
  dueStartDate?: string;
  dueEndDate?: string;
  startDate?: string;
  endDate?: string;
  dateField?: 'due' | 'created';
  entityType?: EntityType;
  entityId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export class ActivityService {
  /**
   * Helper to verify target entity exists and user has access
   */
  private async verifyEntity(
    entityType: EntityType,
    entityId: string | Types.ObjectId,
    user: IUser
  ): Promise<void> {
    const id = entityId.toString();

    switch (entityType) {
      case EntityType.LEAD: {
        const lead = await Lead.findById(id);
        if (!lead) {
          throw new AppError(`Lead with ID '${id}' not found`, 404);
        }
        if (user.role === UserRole.EXECUTIVE) {
          if (!lead.assignedTo || lead.assignedTo.toString() !== user._id.toString()) {
            throw new AppError('Forbidden: Executives can only create activities on leads assigned to them', 403);
          }
        }
        break;
      }

      case EntityType.CUSTOMER: {
        const customer = await Customer.findById(id);
        if (!customer) {
          throw new AppError(`Customer with ID '${id}' not found`, 404);
        }
        if (user.role === UserRole.EXECUTIVE) {
          if (!customer.assignedTo || customer.assignedTo.toString() !== user._id.toString()) {
            throw new AppError('Forbidden: Executives can only create activities on customers assigned to them', 403);
          }
        }
        break;
      }

      case EntityType.DEAL: {
        const deal = await Deal.findById(id);
        if (!deal) {
          throw new AppError(`Deal with ID '${id}' not found`, 404);
        }
        if (user.role === UserRole.EXECUTIVE) {
          if (!deal.assignedTo || deal.assignedTo.toString() !== user._id.toString()) {
            throw new AppError('Forbidden: Executives can only create activities on deals assigned to them', 403);
          }
        }
        break;
      }

      case EntityType.USER: {
        const targetUser = await User.findById(id);
        if (!targetUser) {
          throw new AppError(`User with ID '${id}' not found`, 404);
        }
        break;
      }
    }
  }

  /**
   * Helper to check executive access to an activity
   */
  private checkActivityAccess(activity: IActivity, user: IUser): void {
    if (user.role === UserRole.EXECUTIVE) {
      const isAssigned = activity.assignedTo && activity.assignedTo.toString() === user._id.toString();
      const isCreator = activity.createdBy && activity.createdBy.toString() === user._id.toString();
      if (!isAssigned && !isCreator) {
        throw new AppError('Forbidden: Executives can only access activities assigned to them or created by them', 403);
      }
    }
  }

  /**
   * Create activity or follow-up (Access: A, M, E)
   */
  async createActivity(input: CreateActivityInput, user: IUser): Promise<IActivity> {
    await this.verifyEntity(input.entityType, input.entityId, user);

    let assignedUserId: Types.ObjectId | null = null;
    if (input.assignedTo) {
      const assignee = await User.findById(input.assignedTo);
      if (!assignee || !assignee.isActive) {
        throw new AppError('Assigned user not found or inactive', 400);
      }
      assignedUserId = assignee._id;
    } else if (user.role === UserRole.EXECUTIVE) {
      assignedUserId = user._id;
    }

    const descText = (input.description || input.content || '').trim();
    let status = input.status || ActivityStatus.PENDING;
    let completedAt: Date | null = null;

    if (input.type === ActivityType.NOTE && !input.status) {
      status = ActivityStatus.COMPLETED;
      completedAt = new Date();
    } else if (status === ActivityStatus.COMPLETED) {
      completedAt = new Date();
    }

    const activity = await Activity.create({
      type: input.type,
      title: input.title ? input.title.trim() : '',
      description: descText,
      content: descText,
      entityType: input.entityType,
      entityId: new Types.ObjectId(input.entityId.toString()),
      assignedTo: assignedUserId,
      createdBy: user._id,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status,
      completedAt
    });

    // Log timeline event for leads, customers, and deals
    if (input.entityType !== EntityType.USER) {
      const actionName = input.type === ActivityType.NOTE ? TimelineAction.NOTE_ADDED : 'activity_created';
      const summaryText = activity.title || descText.substring(0, 60);
      await logTimeline({
        entityType: input.entityType,
        entityId: activity.entityId,
        action: actionName,
        performedBy: user._id,
        newValue: activity._id,
        description: `${user.name} added ${activity.type}: "${summaryText}"`,
        message: `${user.name} added ${activity.type}: "${summaryText}"`
      });
    }

    return (await Activity.findById(activity._id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')) as IActivity;
  }

  /**
   * List activities with filters (type, status, overdue, assignee, due range) (Access: A, M, E)
   */
  async listActivities(query: ListActivitiesQuery, user: IUser) {
    const filter: Record<string, any> = {};

    // Scope for executives
    if (user.role === UserRole.EXECUTIVE) {
      filter.$or = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
    } else {
      const assigneeId = query.assignedTo || query.assignee;
      if (assigneeId && Types.ObjectId.isValid(assigneeId)) {
        filter.assignedTo = new Types.ObjectId(assigneeId);
      }
    }

    // Type filter
    if (query.type && Object.values(ActivityType).includes(query.type)) {
      filter.type = query.type;
    }

    // Status filter
    if (query.status && Object.values(ActivityStatus).includes(query.status)) {
      filter.status = query.status;
    }

    // Overdue filter
    const isOverdue = query.overdue === true || query.overdue === 'true';
    if (isOverdue) {
      filter.status = ActivityStatus.PENDING;
      filter.dueDate = { $lt: new Date() };
    }

    // Due range filter
    const dueStart = query.dueStartDate || (query.dateField !== 'created' ? query.startDate : undefined);
    const dueEnd = query.dueEndDate || (query.dateField !== 'created' ? query.endDate : undefined);

    if (dueStart || dueEnd) {
      filter.dueDate = filter.dueDate || {};
      if (dueStart) filter.dueDate.$gte = new Date(dueStart);
      if (dueEnd) filter.dueDate.$lte = new Date(dueEnd);
    } else if (query.dateField === 'created' && (query.startDate || query.endDate)) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    // Entity filters
    if (query.entityType && Object.values(EntityType).includes(query.entityType)) {
      filter.entityType = query.entityType;
    }
    if (query.entityId && Types.ObjectId.isValid(query.entityId)) {
      filter.entityId = new Types.ObjectId(query.entityId);
    }

    // Search in title or description
    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      const searchCondition = [
        { title: searchRegex },
        { description: searchRegex }
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchCondition }];
        delete filter.$or;
      } else {
        filter.$or = searchCondition;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const allowedSortFields = ['dueDate', 'createdAt', 'status', 'type', 'title'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .populate('createdBy', 'name email role')
        .populate('assignedTo', 'name email role')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Activity.countDocuments(filter)
    ]);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get activity by ID (Access: A, M, E)
   */
  async getActivityById(id: string, user: IUser): Promise<IActivity> {
    const activity = await Activity.findById(id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role');

    if (!activity) {
      throw new AppError(`Activity with ID '${id}' not found`, 404);
    }

    this.checkActivityAccess(activity, user);
    return activity;
  }

  /**
   * Update activity (Access: A, M, E)
   */
  async updateActivity(id: string, input: UpdateActivityInput, user: IUser): Promise<IActivity> {
    const activity = await Activity.findById(id);
    if (!activity) {
      throw new AppError(`Activity with ID '${id}' not found`, 404);
    }

    this.checkActivityAccess(activity, user);

    if (input.type) {
      activity.type = input.type;
    }

    if (input.title !== undefined) {
      activity.title = input.title.trim();
    }

    const descText = input.description !== undefined ? input.description : input.content;
    if (descText !== undefined) {
      activity.description = descText.trim();
      activity.content = descText.trim();
    }

    if (input.assignedTo !== undefined) {
      if (input.assignedTo === null || input.assignedTo === '') {
        activity.assignedTo = null;
      } else {
        const assignee = await User.findById(input.assignedTo);
        if (!assignee || !assignee.isActive) {
          throw new AppError('Assigned user not found or inactive', 400);
        }
        activity.assignedTo = assignee._id;
      }
    }

    if (input.dueDate !== undefined) {
      activity.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    if (input.status) {
      activity.status = input.status;
      if (input.status === ActivityStatus.COMPLETED && !activity.completedAt) {
        activity.completedAt = new Date();
      } else if (input.status === ActivityStatus.PENDING) {
        activity.completedAt = null;
      }
    }

    await activity.save();

    return (await Activity.findById(id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')) as IActivity;
  }

  /**
   * Mark activity completed (Access: A, M, E)
   */
  async completeActivity(id: string, user: IUser, notes?: string): Promise<IActivity> {
    const activity = await Activity.findById(id);
    if (!activity) {
      throw new AppError(`Activity with ID '${id}' not found`, 404);
    }

    this.checkActivityAccess(activity, user);

    activity.status = ActivityStatus.COMPLETED;
    activity.completedAt = new Date();

    if (notes && notes.trim().length > 0) {
      const appendNote = `\n\n[Completed by ${user.name} on ${new Date().toISOString()}: ${notes.trim()}]`;
      activity.description = (activity.description || '') + appendNote;
      activity.content = activity.description;
    }

    await activity.save();

    return (await Activity.findById(id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')) as IActivity;
  }

  /**
   * Delete activity (Access: A, M, creator)
   */
  async deleteActivity(id: string, user: IUser): Promise<void> {
    const activity = await Activity.findById(id);
    if (!activity) {
      throw new AppError(`Activity with ID '${id}' not found`, 404);
    }

    // Role check: Admin, Manager, or Creator
    const isAdminOrManager = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;
    const isCreator = activity.createdBy && activity.createdBy.toString() === user._id.toString();

    if (!isAdminOrManager && !isCreator) {
      throw new AppError('Forbidden: Only Admin, Manager, or the activity creator can delete this activity', 403);
    }

    await Activity.findByIdAndDelete(id);
  }
}

export const activityService = new ActivityService();
export default activityService;
