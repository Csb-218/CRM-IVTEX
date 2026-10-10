import '../types/express';
import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';

export class DashboardController {
  /**
   * GET /dashboard/summary - Lead, customer, deal, revenue, and activity metrics, plus conversion rate
   * Access: Admin, Manager, Executive (A, M, E)
   */
  getSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await dashboardService.getSummary(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Dashboard summary metrics retrieved successfully',
      data: summary
    });
  });

  /**
   * GET /dashboard/pipeline - Deal count and value per stage
   * Access: Admin, Manager, Executive (A, M, E)
   */
  getPipeline = asyncHandler(async (req: Request, res: Response) => {
    const pipeline = await dashboardService.getPipeline(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Pipeline stage metrics retrieved successfully',
      data: pipeline
    });
  });

  /**
   * GET /dashboard/team-performance - Per-executive leads, conversions, revenue
   * Access: Admin, Manager (A, M)
   */
  getTeamPerformance = asyncHandler(async (req: Request, res: Response) => {
    const performance = await dashboardService.getTeamPerformance(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Team performance metrics retrieved successfully',
      data: performance
    });
  });

  /**
   * GET /dashboard/lead-sources - Lead count and conversion by source
   * Access: Admin, Manager (A, M)
   */
  getLeadSources = asyncHandler(async (req: Request, res: Response) => {
    const sources = await dashboardService.getLeadSources(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Lead sources metrics retrieved successfully',
      data: sources
    });
  });
}

export const dashboardController = new DashboardController();
export default dashboardController;
