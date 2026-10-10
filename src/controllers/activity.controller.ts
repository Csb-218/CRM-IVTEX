import '../types/express';
import { Request, Response } from 'express';
import { activityService } from '../services/activity.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse, getParamId } from '../utils/apiResponse';

export class ActivityController {
  /**
   * POST /activities - Create activity or follow-up (Access: A, M, E)
   */
  createActivity = asyncHandler(async (req: Request, res: Response) => {
    const activity = await activityService.createActivity(req.body, req.user!);
    return sendResponse({
      res,
      statusCode: 201,
      message: 'Activity created successfully',
      data: activity
    });
  });

  /**
   * GET /activities - List activities (type, status, overdue, assignee, due range) (Access: A, M, E)
   */
  listActivities = asyncHandler(async (req: Request, res: Response) => {
    const result = await activityService.listActivities(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Activities retrieved successfully',
      data: result.activities,
      pagination: result.pagination
    });
  });

  /**
   * GET /activities/:id - Get activity (Access: A, M, E)
   */
  getActivityById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const activity = await activityService.getActivityById(id, req.user!);
    return sendResponse({
      res,
      message: 'Activity retrieved successfully',
      data: activity
    });
  });

  /**
   * PUT /activities/:id - Update activity (Access: A, M, E)
   */
  updateActivity = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updated = await activityService.updateActivity(id, req.body, req.user!);
    return sendResponse({
      res,
      message: 'Activity updated successfully',
      data: updated
    });
  });

  /**
   * PATCH /activities/:id/complete - Mark activity completed (Access: A, M, E)
   */
  completeActivity = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const notes = req.body?.notes || req.body?.outcome;
    const completed = await activityService.completeActivity(id, req.user!, notes);
    return sendResponse({
      res,
      message: 'Activity marked as completed successfully',
      data: completed
    });
  });

  /**
   * DELETE /activities/:id - Delete activity (Access: A, M, creator)
   */
  deleteActivity = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    await activityService.deleteActivity(id, req.user!);
    return sendResponse({
      res,
      message: 'Activity deleted successfully'
    });
  });
}

export const activityController = new ActivityController();
export default activityController;
