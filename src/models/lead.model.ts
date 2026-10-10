import { Schema, model, Document, Types } from 'mongoose';

export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  SOCIAL = 'social',
  EMAIL = 'email',
  PHONE = 'phone',
  OTHER = 'other'
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  UNQUALIFIED = 'unqualified',
  CONVERTED = 'converted',
  LOST = 'lost'
}

export enum LeadPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface ILead extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  dealId?: Types.ObjectId | null;
  convertedAt?: Date | null;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
      maxlength: [100, 'Lead name cannot exceed 100 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    company: {
      type: String,
      trim: true,
      default: ''
    },
    source: {
      type: String,
      enum: {
        values: Object.values(LeadSource),
        message: '{VALUE} is not a valid lead source'
      },
      default: LeadSource.WEBSITE
    },
    status: {
      type: String,
      enum: {
        values: Object.values(LeadStatus),
        message: '{VALUE} is not a valid lead status'
      },
      default: LeadStatus.NEW
    },
    priority: {
      type: String,
      enum: {
        values: Object.values(LeadPriority),
        message: '{VALUE} is not a valid lead priority'
      },
      default: LeadPriority.MEDIUM
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      default: null
    },
    convertedAt: {
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

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });

export const Lead = model<ILead>('Lead', leadSchema);
export default Lead;
