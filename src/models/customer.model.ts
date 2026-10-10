import { Schema, model, Document, Types } from 'mongoose';

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

export interface ICustomerAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: ICustomerAddress;
  leadId?: Types.ObjectId | null;
  assignedTo?: Types.ObjectId | null;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Customer email is required'],
      unique: true,
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
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' }
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(CustomerStatus),
        message: '{VALUE} is not a valid customer status'
      },
      default: CustomerStatus.ACTIVE
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

customerSchema.index({ status: 1, createdAt: -1 });
customerSchema.index({ assignedTo: 1, status: 1 });

export const Customer = model<ICustomer>('Customer', customerSchema);
export default Customer;
