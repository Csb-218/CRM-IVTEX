import '../types/express';
import { Request, Response } from 'express';
import { customerService } from '../services/customer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse, getParamId } from '../utils/apiResponse';

export class CustomerController {
  /**
   * POST /customers - Create customer directly (Access: A, M, E)
   */
  createCustomer = asyncHandler(async (req: Request, res: Response) => {
    const customer = await customerService.createCustomer(req.body, req.user!);
    return sendResponse({
      res,
      statusCode: 201,
      message: 'Customer created successfully',
      data: customer
    });
  });

  /**
   * GET /customers - List with filters, search, date range (Access: A, M, E)
   */
  listCustomers = asyncHandler(async (req: Request, res: Response) => {
    const result = await customerService.listCustomers(req.query, req.user!);
    return sendResponse({
      res,
      message: 'Customers retrieved successfully',
      data: result.customers,
      pagination: result.pagination
    });
  });

  /**
   * GET /customers/:id - Get customer with original lead (Access: A, M, E)
   */
  getCustomerById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const customer = await customerService.getCustomerById(id, req.user!);
    return sendResponse({
      res,
      message: 'Customer retrieved successfully',
      data: customer
    });
  });

  /**
   * PUT /customers/:id - Update customer (Access: A, M, E)
   */
  updateCustomer = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedCustomer = await customerService.updateCustomer(id, req.body, req.user!);
    return sendResponse({
      res,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  });

  /**
   * GET /customers/:id/deals - Deals of this customer (Access: A, M, E)
   */
  getCustomerDeals = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const deals = await customerService.getCustomerDeals(id, req.user!);
    return sendResponse({
      res,
      message: 'Customer deals retrieved successfully',
      data: deals
    });
  });

  /**
   * GET /customers/:id/activities - Activities on this customer (Access: A, M, E)
   */
  getActivities = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const activities = await customerService.getActivities(id, req.user!);
    return sendResponse({
      res,
      message: 'Customer activities retrieved successfully',
      data: activities
    });
  });

  /**
   * GET /customers/:id/timeline - Audit history (Access: A, M, E)
   */
  getTimeline = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const timeline = await customerService.getTimeline(id, req.user!);
    return sendResponse({
      res,
      message: 'Customer timeline history retrieved successfully',
      data: timeline
    });
  });

  /**
   * DELETE /customers/:id - Delete (blocked if open deals exist) (Access: Admin only)
   */
  deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    await customerService.deleteCustomer(id);
    return sendResponse({
      res,
      message: 'Customer deleted successfully'
    });
  });
}

export const customerController = new CustomerController();
export default customerController;
