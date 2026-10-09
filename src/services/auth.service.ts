import { Types } from 'mongoose';
import { User, IUser, UserRole } from '../models/user.model';
import { AppError } from '../utils/appError';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../utils/token';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: UserRole;
  managerId?: string | Types.ObjectId | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
}

export class AuthService {
  /**
   * Register a user
   * Public (defaults to executive) or Admin (can assign any role)
   */
  async register(input: RegisterInput, requestingUser?: IUser) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check if email is already taken
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError(`A user with email '${normalizedEmail}' already exists`, 409);
    }

    const totalUsers = await User.countDocuments();
    let assignedRole = input.role || UserRole.EXECUTIVE;

    // Role authorization check:
    // 1. If system has 0 users, bootstrap first user as Admin if requested
    // 2. If requester is logged-in Admin, allow assigning any role
    // 3. Otherwise, public registrations cannot self-assign Admin or Manager
    if (totalUsers > 0 && (!requestingUser || requestingUser.role !== UserRole.ADMIN)) {
      if (input.role && [UserRole.ADMIN, UserRole.MANAGER].includes(input.role)) {
        throw new AppError(
          'Only administrators can register admin or manager accounts. Please register as an executive',
          403
        );
      }
      assignedRole = UserRole.EXECUTIVE;
    }

    // Validate managerId if provided
    if (input.managerId) {
      const manager = await User.findById(input.managerId);
      if (!manager) {
        throw new AppError('Assigned manager does not exist', 400);
      }
      if (![UserRole.MANAGER, UserRole.ADMIN].includes(manager.role)) {
        throw new AppError('Assigned manager must have manager or admin role', 400);
      }
    }

    const newUser = await User.create({
      name: input.name.trim(),
      email: normalizedEmail,
      password: input.password,
      phone: input.phone?.trim() || '',
      role: assignedRole,
      managerId: input.managerId || null,
      isActive: true
    });

    const accessToken = generateAccessToken({
      id: newUser._id.toString(),
      role: newUser.role,
      email: newUser.email
    });

    const refreshToken = generateRefreshToken({
      id: newUser._id.toString()
    });

    newUser.refreshToken = refreshToken;
    await newUser.save();

    const populatedUser = (await User.findById(newUser._id).populate('managerId', 'name email role')) as IUser;

    return {
      user: populatedUser,
      accessToken,
      refreshToken
    };
  }

  /**
   * Login user and issue tokens
   */
  async login(input: LoginInput) {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select('+password +refreshToken');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact an administrator', 403);
    }

    const accessToken = generateAccessToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email
    });

    const refreshToken = generateRefreshToken({
      id: user._id.toString()
    });

    user.refreshToken = refreshToken;
    await user.save();

    const populatedUser = (await User.findById(user._id).populate('managerId', 'name email role')) as IUser;

    return {
      user: populatedUser,
      accessToken,
      refreshToken
    };
  }

  /**
   * Issue a new access token and rotated refresh token
   */
  async refreshAccessToken(token: string) {
    if (!token) {
      throw new AppError('Refresh token is required', 400);
    }

    let decoded: any;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new AppError('Invalid or expired refresh token. Please log in again', 401);
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.isActive) {
      throw new AppError('User not found or account is deactivated', 401);
    }

    if (!user.refreshToken || user.refreshToken !== token) {
      throw new AppError('Invalid or revoked refresh token. Please log in again', 401);
    }

    // Generate new access token and rotate refresh token
    const newAccessToken = generateAccessToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email
    });

    const newRefreshToken = generateRefreshToken({
      id: user._id.toString()
    });

    user.refreshToken = newRefreshToken;
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * Logout user and invalidate stored refresh token
   */
  async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  }

  /**
   * Get current user profile
   */
  async getMe(userId: string): Promise<IUser> {
    const user = await User.findById(userId).populate('managerId', 'name email role');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  /**
   * Update own profile
   */
  async updateMe(userId: string, input: UpdateProfileInput): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (input.name !== undefined) user.name = input.name.trim();
    if (input.phone !== undefined) user.phone = input.phone.trim();

    await user.save();

    return (await User.findById(userId).populate('managerId', 'name email role')) as IUser;
  }

  /**
   * Change own password
   */
  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
    const user = await User.findById(userId).select('+password +refreshToken');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isMatch = await user.comparePassword(currentPass);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400);
    }

    user.password = newPass;
    // Invalidate refresh token on password change
    user.refreshToken = null;
    await user.save();
  }
}

export const authService = new AuthService();
export default authService;
