import { Types } from 'mongoose';
import { TimelineLog, ITimelineLog } from '../models/timeline.model';
import { EntityType } from '../models/activity.model';

export interface QueryTimelineInput {
  entityType?: EntityType;
  entityId?: string;
  action?: string;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export class TimelineService {
  /**
   * Query timeline logs by entityType, entityId, action, date range (Access: A, M)
   */
  async queryTimeline(query: QueryTimelineInput) {
    const filter: Record<string, any> = {};

    if (query.entityType && Object.values(EntityType).includes(query.entityType)) {
      filter.entityType = query.entityType;
    }

    if (query.entityId && Types.ObjectId.isValid(query.entityId)) {
      filter.entityId = new Types.ObjectId(query.entityId);
    }

    if (query.action && query.action.trim().length > 0) {
      filter.action = query.action.trim();
    }

    if (query.performedBy && Types.ObjectId.isValid(query.performedBy)) {
      filter.performedBy = new Types.ObjectId(query.performedBy);
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { message: searchRegex },
        { description: searchRegex },
        { action: searchRegex }
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'action', 'entityType'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [logs, total] = await Promise.all([
      TimelineLog.find(filter)
        .populate('performedBy', 'name email role')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      TimelineLog.countDocuments(filter)
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export const timelineService = new TimelineService();
export default timelineService;
