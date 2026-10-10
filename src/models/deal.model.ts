import { Schema, model, Document, Types } from 'mongoose';

export enum DealStage {
  QUALIFICATION = 'qualification',
  DISCOVERY = 'discovery',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost'
}

export interface IDeal extends Document {
  _id: Types.ObjectId;
  name: string;
  leadId?: Types.ObjectId | null;
  customerId: Types.ObjectId;
  assignedTo: Types.ObjectId;
  value: number;
  probability: number;
  expectedRevenue: number;
  expectedCloseDate?: Date | null;
  stage: DealStage;
  lostReason?: string | null;
  closedAt?: Date | null;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema<IDeal>(
  {
    name: {
      type: String,
      required: [true, 'Deal name is required'],
      trim: true,
      maxlength: [120, 'Deal name cannot exceed 120 characters']
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
      index: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user ID is required'],
      index: true
    },
    value: {
      type: Number,
      required: [true, 'Deal value is required'],
      min: [0.01, 'Deal value must be greater than 0']
    },
    probability: {
      type: Number,
      default: 0,
      min: [0, 'Probability must be between 0 and 100'],
      max: [100, 'Probability must be between 0 and 100']
    },
    expectedRevenue: {
      type: Number,
      default: 0
    },
    expectedCloseDate: {
      type: Date,
      default: null
    },
    stage: {
      type: String,
      enum: {
        values: Object.values(DealStage),
        message: '{VALUE} is not a valid deal stage'
      },
      default: DealStage.QUALIFICATION
    },
    lostReason: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (this: any, val: string | null) {
          const stage = this?.stage || this?.get?.('stage');
          if (stage === DealStage.LOST) {
            return typeof val === 'string' && val.trim().length > 0;
          }
          return true;
        },
        message: 'Lost reason is required when deal stage is lost'
      }
    },
    closedAt: {
      type: Date,
      default: null
    },
    description: {
      type: String,
      trim: true,
      default: ''
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

// Pre-save hook: compute expectedRevenue and manage closedAt
dealSchema.pre('save', function (this: any) {
  if (this.value !== undefined && this.probability !== undefined) {
    this.expectedRevenue = Math.round(this.value * (this.probability / 100) * 100) / 100;
  }

  // Set closedAt timestamp when moving to terminal stages (won / lost)
  if ([DealStage.WON, DealStage.LOST].includes(this.stage) && !this.closedAt) {
    this.closedAt = new Date();
  } else if (![DealStage.WON, DealStage.LOST].includes(this.stage)) {
    this.closedAt = null;
    this.lostReason = null;
  }
});

dealSchema.index({ stage: 1, createdAt: -1 });
dealSchema.index({ customerId: 1, stage: 1 });
dealSchema.index({ assignedTo: 1, stage: 1 });

export const Deal = model<IDeal>('Deal', dealSchema);
export default Deal;
