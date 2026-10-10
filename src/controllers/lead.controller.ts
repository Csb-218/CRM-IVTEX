import '../types/express';
import { Request, Response } from 'express';
import { leadService } from '../services/lead.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse, getParamId } from '../utils/apiResponse';

export class LeadController {
  /**
   * POST /leads - Create lead (Access: A, M, E)
   */
  createLead = asyncHandler(async (req: Request, res: Response) => {
    const lead = await leadService.createLead(req.body, req.user!);
    return sendResponse({
      res,
      statusCode: 201,
      message: 'Lead created successfully',
      data: lead
    });
  });

  /**
   * GET /leads - List with filters, search, date range (Access: A, M, E)
   */
  listLeads = asyncHandler(async (req: Request, res: Response) => {
    const result = await leadService.listLeads(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Leads retrieved successfully',
      data: result.leads,
      pagination: result.pagination
    });
  });

  /**
   * GET /leads/:id - Get lead (Access: A, M, E)
   */
  getLeadById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const lead = await leadService.getLeadById(id, req.user!);
    return sendResponse({
      res,
      message: 'Lead retrieved successfully',
      data: lead
    });
  });

  /**
   * PUT /leads/:id - Update lead (Access: A, M, E)
   */
  updateLead = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedLead = await leadService.updateLead(id, req.body, req.user!);
    return sendResponse({
      res,
      message: 'Lead updated successfully',
      data: updatedLead
    });
  });

  /**
   * PATCH /leads/:id/status - Change status with transition rules (Access: A, M, E)
   */
  changeStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedLead = await leadService.changeStatus(id, req.body.status, req.user!);
    return sendResponse({
      res,
      message: 'Lead status updated successfully',
      data: updatedLead
    });
  });

  /**
   * PATCH /leads/:id/assign - Assign or reassign (Access: A, M)
   */
  assignLead = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedLead = await leadService.assignLead(id, req.body.assignedTo, req.user!);
    return sendResponse({
      res,
      message: 'Lead assigned successfully',
      data: updatedLead
    });
  });

  /**
   * POST /leads/:id/convert - Convert to customer and deal (Access: A, M, E)
   */
  convertLead = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const result = await leadService.convertLead(id, req.body, req.user!);
    return sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: {
        lead: result.lead,
        customer: result.customer,
        deal: result.deal
      }
    });
  });

  /**
   * POST /leads/:id/notes - Add a note (Access: A, M, E)
   */
  addNote = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const note = await leadService.addNote(id, req.body.content, req.body.title || '', req.user!);
    return sendResponse({
      res,
      statusCode: 201,
      message: 'Note added successfully',
      data: note
    });
  });

  /**
   * GET /leads/:id/activities - Activities on this lead (Access: A, M, E)
   */
  getActivities = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const activities = await leadService.getActivities(id, req.user!);
    return sendResponse({
      res,
      message: 'Lead activities retrieved successfully',
      data: activities
    });
  });

  /**
   * GET /leads/:id/timeline - Audit history (Access: A, M, E)
   */
  getTimeline = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const timeline = await leadService.getTimeline(id, req.user!);
    return sendResponse({
      res,
      message: 'Lead timeline history retrieved successfully',
      data: timeline
    });
  });

  /**
   * DELETE /leads/:id - Delete lead (Access: Admin only)
   */
  deleteLead = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    await leadService.deleteLead(id);
    return sendResponse({
      res,
      message: 'Lead deleted successfully'
    });
  });
}

export const leadController = new LeadController();
export default leadController;
