import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/user.model';
import { AppError } from '../utils/appError';
import { verifyToken } from '../utils/token';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // Dev fallback: allow x-user-id header in development environment for quick testing
    if (!token && process.env.NODE_ENV !== 'production' && req.headers['x-user-id']) {
      const devUser = await User.findById(req.headers['x-user-id']);
      if (devUser && devUser.isActive) {
        req.user = devUser;
        return next();
      }
    }

    if (!token) {
      return next(new AppError('Authentication required. Please provide a valid Bearer token', 401));
    }

    const decoded = verifyToken(token);
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('This user account has been deactivated', 403));
    }

    req.user = currentUser;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please authenticate again', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again', 401));
    }
    return next(error);
  }
};

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        const currentUser = await User.findById(decoded.id);
        if (currentUser && currentUser.isActive) {
          req.user = currentUser;
        }
      } catch {
        // Silently ignore invalid token in optional auth
      }
    }
    next();
  } catch {
    next();
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
          403
        )
      );
    }

    next();
  };
};
