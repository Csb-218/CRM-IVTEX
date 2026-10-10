import { Types } from 'mongoose';
import {
  Customer,
  ICustomer,
  CustomerStatus,
  Deal,
  DealStage,
  User,
  UserRole,
  IUser,
  Activity,
  EntityType,
  Timeline,
  TimelineAction
} from '../models';
import { AppError } from '../utils/appError';
import { logTimeline } from '../utils/auditLogger';

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  assignedTo?: string | Types.ObjectId | null;
  status?: CustomerStatus;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  assignedTo?: string | Types.ObjectId | null;
  status?: CustomerStatus;
}

export interface ListCustomersQuery {
  search?: string;
  status?: CustomerStatus;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export class CustomerService {
  /**
   * Helper to check executive access to customer
   */
  private checkAccess(customer: ICustomer, user: IUser) {
    if (user.role === UserRole.EXECUTIVE) {
      if (!customer.assignedTo || customer.assignedTo.toString() !== user._id.toString()) {
        throw new AppError('Forbidden: Executives can only view or manage customers assigned to them', 403);
      }
    }
  }

  /**
   * Create customer directly (Access: A, M, E)
   */
  async createCustomer(input: CreateCustomerInput, user: IUser): Promise<ICustomer> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingCustomer = await Customer.findOne({ email: normalizedEmail });
    if (existingCustomer) {
      throw new AppError(`Customer with email '${normalizedEmail}' already exists`, 409);
    }

    let assignedUserId: Types.ObjectId | null = null;
    if (input.assignedTo) {
      const assignee = await User.findById(input.assignedTo);
      if (!assignee || !assignee.isActive) {
        throw new AppError('Assigned user not found or inactive', 400);
      }
      assignedUserId = new Types.ObjectId(input.assignedTo.toString());
    } else if (user.role === UserRole.EXECUTIVE) {
      assignedUserId = user._id;
    }

    const customer = await Customer.create({
      ...input,
      email: normalizedEmail,
      assignedTo: assignedUserId
    });

    await logTimeline({
      entityType: EntityType.CUSTOMER,
      entityId: customer._id,
      action: TimelineAction.CREATED,
      performedBy: user._id,
      description: `Customer created directly by ${user.name}`
    });

    return (await Customer.findById(customer._id)
      .populate('assignedTo', 'name email role')) as ICustomer;
  }

  /**
   * List customers with filters, search, and date range (Access: A, M, E)
   */
  async listCustomers(query: ListCustomersQuery, user: IUser) {
    const filter: Record<string, any> = {};

    if (user.role === UserRole.EXECUTIVE) {
      filter.assignedTo = user._id;
    } else if (query.assignedTo && Types.ObjectId.isValid(query.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }

    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { company: searchRegex }
      ];
    }

    if (query.status && Object.values(CustomerStatus).includes(query.status)) {
      filter.status = query.status;
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'company', 'status'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate('assignedTo', 'name email role')
        .populate('leadId', 'name status source')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(filter)
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get customer with original lead (Access: A, M, E)
   */
  async getCustomerById(id: string, user: IUser): Promise<ICustomer> {
    const customer = await Customer.findById(id)
      .populate('leadId', 'name email phone status source createdAt convertedAt')
      .populate('assignedTo', 'name email role phone');

    if (!customer) {
      throw new AppError(`Customer with ID '${id}' not found`, 404);
    }

    this.checkAccess(customer, user);
    return customer;
  }

  /**
   * Update customer (Access: A, M, E)
   */
  async updateCustomer(id: string, input: UpdateCustomerInput, user: IUser): Promise<ICustomer> {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new AppError(`Customer with ID '${id}' not found`, 404);
    }

    this.checkAccess(customer, user);

    if (input.email) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail !== customer.email) {
        const existing = await Customer.findOne({ email: normalizedEmail, _id: { $ne: id } });
        if (existing) {
          throw new AppError(`Customer with email '${normalizedEmail}' already exists`, 409);
        }
        customer.email = normalizedEmail;
      }
    }

    if (input.assignedTo !== undefined && [UserRole.ADMIN, UserRole.MANAGER].includes(user.role)) {
      if (input.assignedTo === null || input.assignedTo === '') {
        customer.assignedTo = null;
      } else {
        const assignee = await User.findById(input.assignedTo);
        if (!assignee || !assignee.isActive) {
          throw new AppError('Assigned user not found or inactive', 400);
        }
        customer.assignedTo = new Types.ObjectId(input.assignedTo.toString());
      }
    }

    if (input.status && input.status !== customer.status) {
      await logTimeline({
        entityType: EntityType.CUSTOMER,
        entityId: customer._id,
        action: TimelineAction.STATUS_CHANGED,
        performedBy: user._id,
        previousValue: customer.status,
        newValue: input.status,
        description: `Customer status changed to '${input.status}' by ${user.name}`
      });
      customer.status = input.status;
    }

    if (input.name !== undefined) customer.name = input.name.trim();
    if (input.phone !== undefined) customer.phone = input.phone.trim();
    if (input.company !== undefined) customer.company = input.company.trim();
    if (input.address) {
      customer.address = {
        ...customer.address,
        ...input.address
      };
    }

    await customer.save();

    return (await Customer.findById(id)
      .populate('leadId', 'name status source')
      .populate('assignedTo', 'name email role')) as ICustomer;
  }

  /**
   * Get all deals belonging to this customer (Access: A, M, E)
   */
  async getCustomerDeals(id: string, user: IUser) {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new AppError(`Customer with ID '${id}' not found`, 404);
    }

    this.checkAccess(customer, user);

    const filter: Record<string, any> = { customerId: customer._id };
    if (user.role === UserRole.EXECUTIVE) {
      filter.assignedTo = user._id;
    }

    return await Deal.find(filter)
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Get activities on this customer (Access: A, M, E)
   */
  async getActivities(id: string, user: IUser) {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new AppError(`Customer with ID '${id}' not found`, 404);
    }

    this.checkAccess(customer, user);

    return await Activity.find({
      entityType: EntityType.CUSTOMER,
      entityId: customer._id
    })
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Get timeline audit history on this customer (Access: A, M, E)
   */
  async getTimeline(id: string, user: IUser) {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new AppError(`Customer with ID '${id}' not found`, 404);
    }

    this.checkAccess(customer, user);

    return await Timeline.find({
      entityType: EntityType.CUSTOMER,
      entityId: customer._id
    })
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Delete customer - blocked if open deals exist (Access: Admin only)
   */
  async deleteCustomer(id: string): Promise<void> {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new AppError(`Customer with ID '${id}' not found`, 404);
    }

    // Check for open deals (not won and not lost)
    const openDealsCount = await Deal.countDocuments({
      customerId: id,
      stage: { $nin: [DealStage.WON, DealStage.LOST] }
    });

    if (openDealsCount > 0) {
      throw new AppError(
        `Cannot delete customer: ${openDealsCount} open deal(s) currently exist for this customer. Please close or reassign the deals before deleting.`,
        400
      );
    }

    await Promise.all([
      Customer.findByIdAndDelete(id),
      Activity.deleteMany({ entityType: EntityType.CUSTOMER, entityId: id }),
      Timeline.deleteMany({ entityType: EntityType.CUSTOMER, entityId: id })
    ]);
  }
}

export const customerService = new CustomerService();
export default customerService;
