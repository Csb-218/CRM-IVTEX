import '../types/express';
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendResponse } from '../utils/apiResponse';
import { setAuthCookies, clearAuthCookies } from '../utils/token';

export class AuthController {
  /**
   * POST /auth/register - Register a user (Access: Public or Admin only)
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body, req.user);

    // Set HTTP-only secure cookies
    setAuthCookies(res, result.accessToken, result.refreshToken);

    return sendResponse({
      res,
      statusCode: 201,
      message: 'User registered successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    });
  });

  /**
   * POST /auth/login - Login and set tokens (Access: Public)
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    // Set HTTP-only secure cookies
    setAuthCookies(res, result.accessToken, result.refreshToken);

    return sendResponse({
      res,
      message: 'Logged in successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    });
  });

  /**
   * POST /auth/refresh - Issue new access token (Access: Public / refresh token)
   */
  refresh = asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await authService.refreshAccessToken(rawToken);

    // Update rotated tokens in cookies
    setAuthCookies(res, result.accessToken, result.refreshToken);

    return sendResponse({
      res,
      message: 'Access token issued successfully',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    });
  });

  /**
   * POST /auth/logout - Clear auth cookies (Access: Logged in)
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?._id) {
      await authService.logout(req.user._id.toString());
    }

    clearAuthCookies(res);

    return sendResponse({
      res,
      message: 'Logged out successfully'
    });
  });

  /**
   * GET /auth/me - Current user profile (Access: Logged in)
   */
  getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!._id.toString());

    return sendResponse({
      res,
      message: 'Profile retrieved successfully',
      data: user
    });
  });

  /**
   * PATCH /auth/me - Update own profile (Access: Logged in)
   */
  updateMe = asyncHandler(async (req: Request, res: Response) => {
    const updatedUser = await authService.updateMe(req.user!._id.toString(), req.body);

    return sendResponse({
      res,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  });

  /**
   * PATCH /auth/change-password - Change own password (Access: Logged in)
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(
      req.user!._id.toString(),
      req.body.currentPassword,
      req.body.newPassword
    );

    clearAuthCookies(res);

    return sendResponse({
      res,
      message: 'Password changed successfully. Please log in with your new password'
    });
  });
}

export const authController = new AuthController();
export default authController;
