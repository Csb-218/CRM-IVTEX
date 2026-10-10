import '../types/express';
import { Request, Response } from 'express';
import { timelineService } from '../services/timeline.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';

export class TimelineController {
  /**
   * GET /timeline - Query timeline by entityType, entityId, action, date range (Access: A, M)
   */
  getTimeline = asyncHandler(async (req: Request, res: Response) => {
    const result = await timelineService.queryTimeline(req.query);
    return sendResponse({
      res,
      message: 'Timeline logs retrieved successfully',
      data: result.logs,
      pagination: result.pagination
    });
  });
}

export const timelineController = new TimelineController();
export default timelineController;
