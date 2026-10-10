import '../types/express';
import { Request, Response } from 'express';
import { dealService } from '../services/deal.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse, getParamId } from '../utils/apiResponse';

export class DealController {
  /**
   * POST /deals - Create deal (Access: A, M, E)
   */
  createDeal = asyncHandler(async (req: Request, res: Response) => {
    const deal = await dealService.createDeal(req.body, req.user!);
    return sendResponse({
      res,
      statusCode: 201,
      message: 'Deal created successfully',
      data: deal
    });
  });

  /**
   * GET /deals - List with filters (stage, assignee, value range, closing date) (Access: A, M, E)
   */
  listDeals = asyncHandler(async (req: Request, res: Response) => {
    const result = await dealService.listDeals(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Deals retrieved successfully',
      data: result.deals,
      pagination: result.pagination
    });
  });

  /**
   * GET /deals/:id - Get deal (Access: A, M, E)
   */
  getDealById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const deal = await dealService.getDealById(id, req.user!);
    return sendResponse({
      res,
      message: 'Deal retrieved successfully',
      data: deal
    });
  });

  /**
   * PUT /deals/:id - Update deal details (Access: A, M, E)
   */
  updateDeal = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedDeal = await dealService.updateDeal(id, req.body, req.user!);
    return sendResponse({
      res,
      message: 'Deal updated successfully',
      data: updatedDeal
    });
  });

  /**
   * PATCH /deals/:id/stage - Move stage (lostReason required for Lost) (Access: A, M, E)
   */
  moveStage = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const { stage, lostReason, expectedCloseDate } = req.body;
    const updatedDeal = await dealService.moveStage(
      id,
      stage,
      lostReason,
      expectedCloseDate,
      req.user!
    );
    return sendResponse({
      res,
      message: 'Deal stage updated successfully',
      data: updatedDeal
    });
  });

  /**
   * PATCH /deals/:id/assign - Reassign deal (Access: A, M)
   */
  assignDeal = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedDeal = await dealService.assignDeal(id, req.body.assignedTo, req.user!);
    return sendResponse({
      res,
      message: 'Deal reassigned successfully',
      data: updatedDeal
    });
  });

  /**
   * GET /deals/:id/activities - Activities on this deal (Access: A, M, E)
   */
  getActivities = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const activities = await dealService.getActivities(id, req.user!);
    return sendResponse({
      res,
      message: 'Deal activities retrieved successfully',
      data: activities
    });
  });

  /**
   * GET /deals/:id/timeline - Audit history (Access: A, M, E)
   */
  getTimeline = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const timeline = await dealService.getTimeline(id, req.user!);
    return sendResponse({
      res,
      message: 'Deal timeline history retrieved successfully',
      data: timeline
    });
  });

  /**
   * DELETE /deals/:id - Delete deal (Access: Admin only)
   */
  deleteDeal = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    await dealService.deleteDeal(id);
    return sendResponse({
      res,
      message: 'Deal deleted successfully'
    });
  });
}

export const dealController = new DealController();
export default dealController;
