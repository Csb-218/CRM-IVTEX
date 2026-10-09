import { Types } from 'mongoose';
import { User, IUser, UserRole } from '../models/user.model';
import { AppError } from '../utils/appError';

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  managerId?: string | Types.ObjectId | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  managerId?: string | Types.ObjectId | null;
  isActive?: boolean;
}

export interface ListUsersQuery {
  search?: string;
  role?: UserRole;
  isActive?: string | boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export class UserService {
  /**
   * Create a new user (Admin access)
   */
  async createUser(input: CreateUserInput): Promise<IUser> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check email uniqueness
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError(`A user with email '${normalizedEmail}' already exists`, 409);
    }

    // Validate managerId if provided
    if (input.managerId) {
      const manager = await User.findById(input.managerId);
      if (!manager) {
        throw new AppError('Assigned manager does not exist', 400);
      }
      if (![UserRole.MANAGER, UserRole.ADMIN].includes(manager.role)) {
        throw new AppError(`Assigned user must have 'manager' or 'admin' role, but has '${manager.role}'`, 400);
      }
    }

    const user = await User.create({
      ...input,
      email: normalizedEmail,
      managerId: input.managerId || null
    });

    return (await User.findById(user._id).populate('managerId', 'name email role')) as IUser;
  }

  /**
   * List users with search, filters, sorting, and pagination (Admin access)
   */
  async listUsers(query: ListUsersQuery) {
    const filter: Record<string, any> = {};

    // Search filter across name, email, and phone
    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    // Role filter
    if (query.role && Object.values(UserRole).includes(query.role)) {
      filter.role = query.role;
    }

    // Status filter
    if (query.isActive !== undefined && query.isActive !== '') {
      if (typeof query.isActive === 'boolean') {
        filter.isActive = query.isActive;
      } else if (typeof query.isActive === 'string') {
        if (query.isActive.toLowerCase() === 'true' || query.isActive.toLowerCase() === 'active') {
          filter.isActive = true;
        } else if (query.isActive.toLowerCase() === 'false' || query.isActive.toLowerCase() === 'inactive') {
          filter.isActive = false;
        }
      }
    }

    // Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    // Sorting
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'email', 'role', 'isActive'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('managerId', 'name email role')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  /**
   * Get active executives for assignment dropdowns (Admin & Manager access)
   */
  async getAssignableExecutives(managerIdFilter?: string | Types.ObjectId) {
    const filter: Record<string, any> = {
      role: UserRole.EXECUTIVE,
      isActive: true
    };

    if (managerIdFilter) {
      filter.managerId = managerIdFilter;
    }

    const executives = await User.find(filter)
      .select('_id name email phone role managerId isActive createdAt')
      .populate('managerId', 'name email')
      .sort({ name: 1 });

    return executives;
  }

  /**
   * Get user by ID (Admin access)
   */
  async getUserById(id: string): Promise<IUser> {
    const user = await User.findById(id).populate('managerId', 'name email role');
    if (!user) {
      throw new AppError(`User with ID '${id}' not found`, 404);
    }
    return user;
  }

  /**
   * Update user details (Admin access)
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<IUser> {
    const user = await User.findById(id).select('+password');
    if (!user) {
      throw new AppError(`User with ID '${id}' not found`, 404);
    }

    // Check email uniqueness if email is changed
    if (input.email) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: id } });
        if (existingUser) {
          throw new AppError(`A user with email '${normalizedEmail}' already exists`, 409);
        }
        user.email = normalizedEmail;
      }
    }

    // Check managerId
    if (input.managerId !== undefined) {
      if (input.managerId === null || input.managerId === '') {
        user.managerId = null;
      } else {
        if (input.managerId.toString() === id) {
          throw new AppError('A user cannot be their own manager', 400);
        }
        const manager = await User.findById(input.managerId);
        if (!manager) {
          throw new AppError('Assigned manager does not exist', 400);
        }
        if (![UserRole.MANAGER, UserRole.ADMIN].includes(manager.role)) {
          throw new AppError(`Assigned user must have 'manager' or 'admin' role`, 400);
        }
        user.managerId = new Types.ObjectId(input.managerId.toString());
      }
    }

    if (input.name !== undefined) user.name = input.name.trim();
    if (input.phone !== undefined) user.phone = input.phone.trim();
    if (input.role !== undefined) user.role = input.role;
    if (input.isActive !== undefined) user.isActive = input.isActive;
    if (input.password !== undefined && input.password.length >= 6) {
      user.password = input.password;
    }

    await user.save();

    return (await User.findById(id).populate('managerId', 'name email role')) as IUser;
  }

  /**
   * Activate or deactivate user (Admin access)
   */
  async updateUserStatus(id: string, isActive: boolean, currentUserId?: string): Promise<IUser> {
    if (currentUserId && currentUserId === id && !isActive) {
      throw new AppError('Admins cannot deactivate their own account', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError(`User with ID '${id}' not found`, 404);
    }

    user.isActive = isActive;
    await user.save();

    return (await User.findById(id).populate('managerId', 'name email role')) as IUser;
  }

  /**
   * Delete user (Admin access)
   * Blocked if user owns records or manages other users
   */
  async deleteUser(id: string, currentUserId?: string): Promise<void> {
    if (currentUserId && currentUserId === id) {
      throw new AppError('Admins cannot delete their own account', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError(`User with ID '${id}' not found`, 404);
    }

    // Check 1: User is assigned as manager to other users
    const subordinatesCount = await User.countDocuments({ managerId: id });
    if (subordinatesCount > 0) {
      throw new AppError(
        `Cannot delete user: ${subordinatesCount} subordinate user(s) currently report to this user. Reassign their manager before deleting.`,
        400
      );
    }

    // Check 2: Extension point for future CRM owned records (Leads, Deals, Contacts, Tasks)
    // When Lead or Deal models are introduced, check:
    // const ownedLeadsCount = await Lead.countDocuments({ ownerId: id });
    // if (ownedLeadsCount > 0) throw new AppError(...);

    await User.findByIdAndDelete(id);
  }
}

export const userService = new UserService();
export default userService;
