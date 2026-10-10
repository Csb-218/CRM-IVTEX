import { Types } from 'mongoose';
import { Timeline, TimelineAction, EntityType } from '../models';

export interface LogTimelineOptions {
  entityType: EntityType;
  entityId: Types.ObjectId | string;
  action: TimelineAction | string;
  performedBy: Types.ObjectId | string;
  previousValue?: any;
  newValue?: any;
  description: string;
}

export const logTimeline = async (options: LogTimelineOptions) => {
  try {
    return await Timeline.create({
      entityType: options.entityType,
      entityId: new Types.ObjectId(options.entityId.toString()),
      action: options.action,
      performedBy: new Types.ObjectId(options.performedBy.toString()),
      previousValue: options.previousValue,
      newValue: options.newValue,
      description: options.description
    });
  } catch (error) {
    console.error('Failed to log timeline audit entry:', error);
  }
};
