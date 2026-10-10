import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/appError';
import { EntityType } from '../models/activity.model';

export const validateQueryTimeline = (req: Request, _res: Response, next: NextFunction): void => {
  const { entityType, entityId, performedBy, startDate, endDate } = req.query;
  const errors: string[] = [];

  const allowedEntityTypes = [EntityType.LEAD, EntityType.CUSTOMER, EntityType.DEAL];
  if (entityType && !allowedEntityTypes.includes(entityType as EntityType)) {
    errors.push(`entityType must be one of: ${allowedEntityTypes.join(', ')}`);
  }

  if (entityId && !Types.ObjectId.isValid(entityId as string)) {
    errors.push('entityId must be a valid 24-character ObjectId');
  }

  if (performedBy && !Types.ObjectId.isValid(performedBy as string)) {
    errors.push('performedBy must be a valid 24-character ObjectId');
  }

  if (startDate && isNaN(Date.parse(startDate as string))) {
    errors.push('startDate must be a valid ISO date');
  }

  if (endDate && isNaN(Date.parse(endDate as string))) {
    errors.push('endDate must be a valid ISO date');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};
