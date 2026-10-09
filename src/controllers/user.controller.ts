import '../types/express';
import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { UserRole } from '../models/user.model';

const getParamId = (paramVal: string | string[]): string =>
  Array.isArray(paramVal) ? paramVal[0] : paramVal;

export class UserController {
  /**
   * POST /users - Create user (Access: Admin)
   */
  createUser = asyncHandler(async (req: Request, res: Response) => {
    const newUser = await userService.createUser(req.body);
    return sendResponse({
      res,
      statusCode: 201,
      message: 'User created successfully',
      data: newUser
    });
  });

  /**
   * GET /users - List users with search, filter, sort, pagination (Access: Admin)
   */
  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { users, pagination } = await userService.listUsers(req.query);
    return sendResponse({
      res,
      message: 'Users retrieved successfully',
      data: users,
      pagination
    });
  });

  /**
   * GET /users/assignable - Active executives for assignment dropdowns (Access: Admin, Manager)
   */
  getAssignableExecutives = asyncHandler(async (req: Request, res: Response) => {
    let managerIdFilter: string | undefined;
    if (req.user?.role === UserRole.MANAGER && req.query.myTeam === 'true') {
      managerIdFilter = req.user._id.toString();
    } else if (req.query.managerId) {
      managerIdFilter = req.query.managerId as string;
    }

    const executives = await userService.getAssignableExecutives(managerIdFilter);
    return sendResponse({
      res,
      message: 'Assignable executives retrieved successfully',
      data: executives
    });
  });

  /**
   * GET /users/:id - Get user by ID (Access: Admin)
   */
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const user = await userService.getUserById(id);
    return sendResponse({
      res,
      message: 'User details retrieved successfully',
      data: user
    });
  });

  /**
   * PUT /users/:id - Update user (Access: Admin)
   */
  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const updatedUser = await userService.updateUser(id, req.body);
    return sendResponse({
      res,
      message: 'User updated successfully',
      data: updatedUser
    });
  });

  /**
   * PATCH /users/:id/status - Activate or deactivate user (Access: Admin)
   */
  updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const currentUserId = req.user?._id?.toString();
    const updatedUser = await userService.updateUserStatus(id, req.body.isActive, currentUserId);
    return sendResponse({
      res,
      message: `User ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser
    });
  });

  /**
   * DELETE /users/:id - Delete user, blocked if user owns records (Access: Admin)
   */
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const id = getParamId(req.params.id);
    const currentUserId = req.user?._id?.toString();
    await userService.deleteUser(id, currentUserId);
    return sendResponse({
      res,
      message: 'User deleted successfully'
    });
  });
}

export const userController = new UserController();
export default userController;
