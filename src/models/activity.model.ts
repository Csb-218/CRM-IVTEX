import { Schema, model, Document, Types } from 'mongoose';

export enum ActivityType {
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  DEMO = 'demo',
  FOLLOW_UP = 'follow_up',
  REMINDER = 'reminder',
  NOTE = 'note',
  TASK = 'task'
}

export enum ActivityStatus {
  PENDING = 'pending',
  COMPLETED = 'completed'
}

export enum EntityType {
  LEAD = 'lead',
  CUSTOMER = 'customer',
  DEAL = 'deal',
  USER = 'user'
}

export interface IActivity extends Document {
  _id: Types.ObjectId;
  type: ActivityType;
  title?: string;
  description: string;
  content?: string; // backwards compatibility alias for description
  assignedTo?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  dueDate?: Date | null;
  status: ActivityStatus;
  completedAt?: Date | null;
  entityType: EntityType;
  entityId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    type: {
      type: String,
      enum: {
        values: Object.values(ActivityType),
        message: '{VALUE} is not a valid activity type'
      },
      default: ActivityType.NOTE,
      required: [true, 'Activity type is required']
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    content: {
      type: String,
      trim: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: Object.values(ActivityStatus),
        message: '{VALUE} is not a valid activity status'
      },
      default: ActivityStatus.PENDING,
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    },
    entityType: {
      type: String,
      enum: {
        values: Object.values(EntityType),
        message: '{VALUE} is not a valid entity type'
      },
      required: [true, 'Entity type is required'],
      index: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
      index: true
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

// Sync description and content aliases, manage completedAt lifecycle
activitySchema.pre('validate', function () {
  if (this.content && !this.description) {
    this.description = this.content;
  } else if (this.description && !this.content) {
    this.content = this.description;
  }

  // Notes are completed immediately upon creation by default
  if (this.type === ActivityType.NOTE && this.status === ActivityStatus.PENDING && !this.completedAt) {
    this.status = ActivityStatus.COMPLETED;
    this.completedAt = new Date();
  }

  // If status is updated to completed, stamp completedAt
  if (this.status === ActivityStatus.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
  } else if (this.status === ActivityStatus.PENDING) {
    this.completedAt = null;
  }
});

activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ assignedTo: 1, status: 1, dueDate: 1 });

export const Activity = model<IActivity>('Activity', activitySchema);
export default Activity;
