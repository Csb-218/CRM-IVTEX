import { Schema, model, Document, Types } from 'mongoose';
import { EntityType } from './activity.model';

export enum TimelineAction {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNED = 'assigned',
  STAGE_CHANGED = 'stage_changed',
  CONVERTED = 'converted',
  NOTE_ADDED = 'note_added'
}

export interface ITimeline extends Document {
  _id: Types.ObjectId;
  entityType: EntityType;
  entityId: Types.ObjectId;
  action: TimelineAction | string;
  performedBy: Types.ObjectId;
  previousValue?: any;
  newValue?: any;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const timelineSchema = new Schema<ITimeline>(
  {
    entityType: {
      type: String,
      enum: Object.values(EntityType),
      required: true,
      index: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    previousValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    description: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const Timeline = model<ITimeline>('Timeline', timelineSchema);
export default Timeline;
