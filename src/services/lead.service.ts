import mongoose, { Types } from 'mongoose';
import {
  Lead,
  ILead,
  LeadStatus,
  LeadSource,
  LeadPriority,
  Customer,
  CustomerStatus,
  Deal,
  DealStage,
  User,
  UserRole,
  IUser,
  Activity,
  ActivityType,
  EntityType,
  Timeline,
  TimelineAction
} from '../models';
import { AppError } from '../utils/appError';
import { logTimeline } from '../utils/auditLogger';

export interface CreateLeadInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
  assignedTo?: string | Types.ObjectId | null;
  description?: string;
}

export interface UpdateLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
  assignedTo?: string | Types.ObjectId | null;
  description?: string;
}

export interface ListLeadsQuery {
  search?: string;
  status?: LeadStatus;
  source?: LeadSource;
  priority?: LeadPriority;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

export interface ConvertLeadInput {
  dealName?: string;
  dealValue: number;
  dealProbability?: number;
  dealExpectedCloseDate?: string | Date;
  assignedTo?: string | Types.ObjectId;
  customerAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export class LeadService {
  /**
   * Helper to verify executive can access this lead
   */
  private checkAccess(lead: ILead, user: IUser) {
    if (user.role === UserRole.EXECUTIVE) {
      if (!lead.assignedTo || lead.assignedTo.toString() !== user._id.toString()) {
        throw new AppError('Forbidden: Executives can only view or manage leads assigned to them', 403);
      }
    }
  }

  /**
   * Create lead (Access: A, M, E)
   */
  async createLead(input: CreateLeadInput, user: IUser): Promise<ILead> {
    let assignedUserId: Types.ObjectId | null = null;

    if (input.assignedTo) {
      const assignee = await User.findById(input.assignedTo);
      if (!assignee || !assignee.isActive) {
        throw new AppError('Assigned user does not exist or is inactive', 400);
      }
      assignedUserId = new Types.ObjectId(input.assignedTo.toString());
    } else if (user.role === UserRole.EXECUTIVE) {
      // Executives creating leads default to assigning to themselves
      assignedUserId = user._id;
    }

    const lead = await Lead.create({
      ...input,
      assignedTo: assignedUserId,
      createdBy: user._id
    });

    // Write audit log
    await logTimeline({
      entityType: EntityType.LEAD,
      entityId: lead._id,
      action: TimelineAction.CREATED,
      performedBy: user._id,
      newValue: { status: lead.status, assignedTo: assignedUserId },
      description: `Lead created by ${user.name}`
    });

    return (await Lead.findById(lead._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')) as ILead;
  }

  /**
   * List leads with filters, search, and date range (Access: A, M, E)
   * Executives only see leads assigned to them
   */
  async listLeads(query: ListLeadsQuery, user: IUser) {
    const filter: Record<string, any> = {};

    // Scope check: Executives can only see leads assigned to them
    if (user.role === UserRole.EXECUTIVE) {
      filter.assignedTo = user._id;
    } else if (query.assignedTo && Types.ObjectId.isValid(query.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(query.assignedTo);
    }

    // Search by name, email, phone, or company
    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { company: searchRegex }
      ];
    }

    if (query.status && Object.values(LeadStatus).includes(query.status)) {
      filter.status = query.status;
    }

    if (query.source && Object.values(LeadSource).includes(query.source)) {
      filter.source = query.source;
    }

    if (query.priority && Object.values(LeadPriority).includes(query.priority)) {
      filter.priority = query.priority;
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.createdAt.$lte = new Date(query.endDate);
      }
    }

    // Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    // Sorting
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'status', 'priority', 'company'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('assignedTo', 'name email role')
        .populate('createdBy', 'name email role')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter)
    ]);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get single lead by ID (Access: A, M, E)
   */
  async getLeadById(id: string, user: IUser): Promise<ILead> {
    const lead = await Lead.findById(id)
      .populate('assignedTo', 'name email role phone')
      .populate('createdBy', 'name email role')
      .populate('customerId', 'name email company')
      .populate('dealId', 'name value stage expectedRevenue');

    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);
    return lead;
  }

  /**
   * Update lead (Access: A, M, E)
   */
  async updateLead(id: string, input: UpdateLeadInput, user: IUser): Promise<ILead> {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);

    if (lead.status === LeadStatus.CONVERTED && input.status && input.status !== LeadStatus.CONVERTED) {
      throw new AppError('Converted leads cannot change status', 400);
    }

    // Check priority change for audit log
    if (input.priority && input.priority !== lead.priority) {
      await logTimeline({
        entityType: EntityType.LEAD,
        entityId: lead._id,
        action: TimelineAction.PRIORITY_CHANGED,
        performedBy: user._id,
        previousValue: lead.priority,
        newValue: input.priority,
        description: `Priority changed from '${lead.priority}' to '${input.priority}' by ${user.name}`
      });
      lead.priority = input.priority;
    }

    // Check status change for audit log
    if (input.status && input.status !== lead.status) {
      if (input.status === LeadStatus.CONVERTED) {
        throw new AppError('Cannot manually change status to converted. Please use the convert endpoint', 400);
      }
      await logTimeline({
        entityType: EntityType.LEAD,
        entityId: lead._id,
        action: TimelineAction.STATUS_CHANGED,
        performedBy: user._id,
        previousValue: lead.status,
        newValue: input.status,
        description: `Status changed from '${lead.status}' to '${input.status}' by ${user.name}`
      });
      lead.status = input.status;
    }

    if (input.name !== undefined) lead.name = input.name.trim();
    if (input.email !== undefined) lead.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined) lead.phone = input.phone.trim();
    if (input.company !== undefined) lead.company = input.company.trim();
    if (input.source !== undefined) lead.source = input.source;
    if (input.description !== undefined) lead.description = input.description.trim();

    await lead.save();

    return (await Lead.findById(id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')) as ILead;
  }

  /**
   * Change status with lifecycle transition rules (Access: A, M, E)
   */
  async changeStatus(id: string, newStatus: LeadStatus, user: IUser): Promise<ILead> {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new AppError('Converted leads cannot be modified or moved to another status', 400);
    }

    if (newStatus === LeadStatus.CONVERTED) {
      throw new AppError('Cannot manually mark lead as converted. Please use the /convert endpoint', 400);
    }

    const previousStatus = lead.status;
    if (previousStatus === newStatus) {
      return lead;
    }

    lead.status = newStatus;
    await lead.save();

    await logTimeline({
      entityType: EntityType.LEAD,
      entityId: lead._id,
      action: TimelineAction.STATUS_CHANGED,
      performedBy: user._id,
      previousValue: previousStatus,
      newValue: newStatus,
      description: `Lead status changed from '${previousStatus}' to '${newStatus}' by ${user.name}`
    });

    return (await Lead.findById(id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')) as ILead;
  }

  /**
   * Assign or reassign lead to active executive (Access: A, M)
   */
  async assignLead(id: string, assignedToId: string, user: IUser): Promise<ILead> {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    const assignee = await User.findById(assignedToId);
    if (!assignee || !assignee.isActive) {
      throw new AppError('Assigned user not found or is inactive', 400);
    }

    // Must be executive or manager
    if (![UserRole.EXECUTIVE, UserRole.MANAGER].includes(assignee.role)) {
      throw new AppError('Leads can only be assigned to active executives or managers', 400);
    }

    const previousAssigneeId = lead.assignedTo;
    lead.assignedTo = assignee._id;
    await lead.save();

    await logTimeline({
      entityType: EntityType.LEAD,
      entityId: lead._id,
      action: TimelineAction.ASSIGNED,
      performedBy: user._id,
      previousValue: previousAssigneeId,
      newValue: assignee._id,
      description: `Lead assigned to ${assignee.name} (${assignee.role}) by ${user.name}`
    });

    return (await Lead.findById(id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')) as ILead;
  }

  /**
   * Convert lead to Customer and Deal in a transaction (Access: A, M, E)
   * Rule: Only qualified leads can convert, and only once.
   */
  async convertLead(id: string, input: ConvertLeadInput, user: IUser) {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);

    if (lead.status === LeadStatus.CONVERTED || lead.customerId) {
      throw new AppError('Lead has already been converted and cannot be converted again', 400);
    }

    if (lead.status !== LeadStatus.QUALIFIED) {
      throw new AppError(
        `Only qualified leads can convert. Current lead status is '${lead.status}'`,
        400
      );
    }

    const assignedUserId = input.assignedTo
      ? new Types.ObjectId(input.assignedTo.toString())
      : lead.assignedTo || user._id;

    // Transaction execution with graceful fallback for standalone instances
    let session: mongoose.ClientSession | null = null;
    let supportsTransactions = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      supportsTransactions = true;
    } catch {
      // Standalone single-node mongodb does not support replica sessions
      supportsTransactions = false;
      if (session) {
        session.endSession();
        session = null;
      }
    }

    try {
      const sessionOpt = supportsTransactions && session ? { session } : {};

      // 1. Create or link Customer
      let customer = await Customer.findOne({ email: lead.email }).session(session || null);
      if (!customer) {
        const customerDocs = await Customer.create(
          [
            {
              name: lead.name,
              email: lead.email || `${lead.name.toLowerCase().replace(/\s+/g, '')}@crm-contact.com`,
              phone: lead.phone,
              company: lead.company,
              address: input.customerAddress || {},
              leadId: lead._id,
              assignedTo: assignedUserId,
              status: CustomerStatus.ACTIVE
            }
          ],
          sessionOpt
        );
        customer = customerDocs[0];
      }

      // 2. Create Deal
      const dealName = input.dealName?.trim() || `${lead.company || lead.name} - Deal`;
      const dealProbability = input.dealProbability !== undefined ? input.dealProbability : 20;

      const dealDocs = await Deal.create(
        [
          {
            name: dealName,
            customerId: customer._id,
            leadId: lead._id,
            assignedTo: assignedUserId,
            value: input.dealValue,
            probability: dealProbability,
            expectedRevenue: Math.round(input.dealValue * (dealProbability / 100) * 100) / 100,
            expectedCloseDate: input.dealExpectedCloseDate ? new Date(input.dealExpectedCloseDate) : null,
            stage: DealStage.QUALIFICATION,
            description: `Generated from converted lead: ${lead.name}`
          }
        ],
        sessionOpt
      );
      const deal = dealDocs[0];

      // 3. Update Lead
      lead.status = LeadStatus.CONVERTED;
      lead.customerId = customer._id;
      lead.dealId = deal._id;
      lead.convertedAt = new Date();
      await lead.save(sessionOpt);

      if (supportsTransactions && session) {
        await session.commitTransaction();
      }

      // 4. Log timeline audits
      await Promise.all([
        logTimeline({
          entityType: EntityType.LEAD,
          entityId: lead._id,
          action: TimelineAction.CONVERTED,
          performedBy: user._id,
          newValue: { customerId: customer._id, dealId: deal._id },
          description: `Lead converted to customer '${customer.name}' and deal '${deal.name}' by ${user.name}`
        }),
        logTimeline({
          entityType: EntityType.CUSTOMER,
          entityId: customer._id,
          action: TimelineAction.CREATED,
          performedBy: user._id,
          newValue: { leadId: lead._id },
          description: `Customer created via lead conversion of '${lead.name}'`
        }),
        logTimeline({
          entityType: EntityType.DEAL,
          entityId: deal._id,
          action: TimelineAction.CREATED,
          performedBy: user._id,
          newValue: { customerId: customer._id, leadId: lead._id },
          description: `Deal created via lead conversion with value $${deal.value}`
        })
      ]);

      return {
        message: 'Lead converted successfully',
        lead: await Lead.findById(lead._id)
          .populate('customerId', 'name email company')
          .populate('dealId', 'name value stage'),
        customer,
        deal
      };
    } catch (error) {
      if (supportsTransactions && session && session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Add note activity to lead (Access: A, M, E)
   */
  async addNote(id: string, content: string, title: string = '', user: IUser) {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);

    const activity = await Activity.create({
      entityType: EntityType.LEAD,
      entityId: lead._id,
      type: ActivityType.NOTE,
      title: title.trim(),
      content: content.trim(),
      createdBy: user._id
    });

    await logTimeline({
      entityType: EntityType.LEAD,
      entityId: lead._id,
      action: TimelineAction.NOTE_ADDED,
      performedBy: user._id,
      description: `Note added by ${user.name}`
    });

    return await Activity.findById(activity._id).populate('createdBy', 'name email role');
  }

  /**
   * Get all activities on lead (Access: A, M, E)
   */
  async getActivities(id: string, user: IUser) {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);

    return await Activity.find({
      entityType: EntityType.LEAD,
      entityId: lead._id
    })
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Get timeline audit history on lead (Access: A, M, E)
   */
  async getTimeline(id: string, user: IUser) {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    this.checkAccess(lead, user);

    return await Timeline.find({
      entityType: EntityType.LEAD,
      entityId: lead._id
    })
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 });
  }

  /**
   * Delete lead (Access: Admin only)
   */
  async deleteLead(id: string): Promise<void> {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError(`Lead with ID '${id}' not found`, 404);
    }

    await Promise.all([
      Lead.findByIdAndDelete(id),
      Activity.deleteMany({ entityType: EntityType.LEAD, entityId: id }),
      Timeline.deleteMany({ entityType: EntityType.LEAD, entityId: id })
    ]);
  }
}

export const leadService = new LeadService();
export default leadService;
