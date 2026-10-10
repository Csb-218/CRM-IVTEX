import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/appError';

export const validateDashboardQuery = (req: Request, _res: Response, next: NextFunction): void => {
  const { startDate, endDate, timeframe, assignedTo, managerId } = req.query;
  const errors: string[] = [];

  const allowedTimeframes = ['today', 'this_week', 'this_month', 'this_quarter', 'this_year', 'all_time'];
  if (timeframe && !allowedTimeframes.includes(timeframe as string)) {
    errors.push(`timeframe must be one of: ${allowedTimeframes.join(', ')}`);
  }

  if (startDate && isNaN(Date.parse(startDate as string))) {
    errors.push('startDate must be a valid ISO date');
  }

  if (endDate && isNaN(Date.parse(endDate as string))) {
    errors.push('endDate must be a valid ISO date');
  }

  if (assignedTo && !Types.ObjectId.isValid(assignedTo as string)) {
    errors.push('assignedTo must be a valid 24-character ObjectId');
  }

  if (managerId && !Types.ObjectId.isValid(managerId as string)) {
    errors.push('managerId must be a valid 24-character ObjectId');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};
