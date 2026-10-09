import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  EXECUTIVE = 'executive'
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
  managerId?: Types.ObjectId | null;
  isActive: boolean;
  refreshToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
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
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
      minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: '{VALUE} is not a valid role. Allowed roles: admin, manager, executive'
      },
      default: UserRole.EXECUTIVE,
      required: [true, 'Role is required']
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    refreshToken: {
      type: String,
      select: false,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Pre-save hook: auto-hash password if modified
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Helper instance method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(enteredPassword, this.password);
};

export const User = model<IUser>('User', userSchema);
export default User;
