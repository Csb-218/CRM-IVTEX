import { Schema, model, Document, Types } from 'mongoose';
import { EntityType } from './activity.model';

export enum TimelineAction {
  // Leads
  LEAD_CREATED = 'lead_created',
  LEAD_ASSIGNED = 'lead_assigned',
  LEAD_STATUS_CHANGED = 'lead_status_changed',
  LEAD_PRIORITY_CHANGED = 'lead_priority_changed',
  LEAD_CONVERTED = 'lead_converted',

  // Deals
  DEAL_CREATED = 'deal_created',
  DEAL_ASSIGNED = 'deal_assigned',
  DEAL_STAGE_CHANGED = 'deal_stage_changed',
  DEAL_WON = 'deal_won',
  DEAL_LOST = 'deal_lost',

  // Customers
  CUSTOMER_CREATED = 'customer_created',
  CUSTOMER_UPDATED = 'customer_updated',
  CUSTOMER_STATUS_CHANGED = 'customer_status_changed',

  // Activities & Generic
  NOTE_ADDED = 'note_added',
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNED = 'assigned',
  STAGE_CHANGED = 'stage_changed',
  CONVERTED = 'converted'
}

export interface ITimelineLog extends Document {
  _id: Types.ObjectId;
  action: TimelineAction | string;
  entityType: EntityType;
  entityId: Types.ObjectId;
  performedBy: Types.ObjectId;
  previousValue?: any;
  newValue?: any;
  message: string;
  description?: string; // backwards compatibility alias for message
  createdAt: Date;
}

// Alias for backwards compatibility
export type ITimeline = ITimelineLog;

const timelineSchema = new Schema<ITimelineLog>(
  {
    action: {
      type: String,
      required: [true, 'Timeline action is required'],
      index: true
    },
    entityType: {
      type: String,
      enum: {
        values: [EntityType.LEAD, EntityType.CUSTOMER, EntityType.DEAL],
        message: '{VALUE} is not a valid timeline entity type'
      },
      required: [true, 'Entity type is required'],
      index: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
      index: true
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by user ID is required'],
      index: true
    },
    previousValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        if (!ret.message && ret.description) {
          ret.message = ret.description;
        } else if (!ret.description && ret.message) {
          ret.description = ret.message;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Sync message and description aliases
timelineSchema.pre('validate', function () {
  if (this.description && !this.message) {
    this.message = this.description;
  } else if (this.message && !this.description) {
    this.description = this.message;
  }
});

timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const TimelineLog = model<ITimelineLog>('TimelineLog', timelineSchema, 'timelines');
export const Timeline = TimelineLog;
export default TimelineLog;
