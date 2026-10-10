import { Schema, model, Document, Types } from 'mongoose';

export enum ActivityType {
  NOTE = 'note',
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  TASK = 'task'
}

export enum EntityType {
  LEAD = 'lead',
  CUSTOMER = 'customer',
  DEAL = 'deal'
}

export interface IActivity extends Document {
  _id: Types.ObjectId;
  entityType: EntityType;
  entityId: Types.ObjectId;
  type: ActivityType;
  title?: string;
  content: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
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
    type: {
      type: String,
      enum: Object.values(ActivityType),
      default: ActivityType.NOTE,
      required: true
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    content: {
      type: String,
      required: [true, 'Activity content is required'],
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const Activity = model<IActivity>('Activity', activitySchema);
export default Activity;
