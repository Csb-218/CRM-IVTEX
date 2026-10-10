import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/appError';
import { ActivityType, ActivityStatus, EntityType } from '../models/activity.model';

export const validateCreateActivity = (req: Request, _res: Response, next: NextFunction): void => {
  const { type, title, description, content, entityType, entityId, assignedTo, dueDate, status } = req.body;
  const errors: string[] = [];

  // Type validation
  if (!type || !Object.values(ActivityType).includes(type)) {
    errors.push(`Activity type is required and must be one of: ${Object.values(ActivityType).join(', ')}`);
  }

  // Description/Content validation
  const descText = description !== undefined ? description : content;
  if (!descText || typeof descText !== 'string' || descText.trim().length === 0) {
    errors.push('Activity description (or content) is required and must not be empty');
  }

  // Title validation (optional)
  if (title !== undefined && typeof title !== 'string') {
    errors.push('Title must be a string');
  }

  // EntityType validation
  if (!entityType || !Object.values(EntityType).includes(entityType)) {
    errors.push(`entityType is required and must be one of: ${Object.values(EntityType).join(', ')}`);
  }

  // EntityId validation
  if (!entityId || !Types.ObjectId.isValid(entityId)) {
    errors.push('entityId is required and must be a valid 24-character ObjectId');
  }

  // AssignedTo validation (optional)
  if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '') {
    if (!Types.ObjectId.isValid(assignedTo)) {
      errors.push('assignedTo must be a valid 24-character ObjectId');
    }
  }

  // DueDate validation (optional)
  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    if (isNaN(Date.parse(dueDate))) {
      errors.push('dueDate must be a valid ISO date');
    }
  }

  // Status validation (optional)
  if (status !== undefined && !Object.values(ActivityStatus).includes(status)) {
    errors.push(`Status must be one of: ${Object.values(ActivityStatus).join(', ')}`);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateActivity = (req: Request, _res: Response, next: NextFunction): void => {
  const { type, title, description, content, assignedTo, dueDate, status } = req.body;
  const errors: string[] = [];

  if (type !== undefined && !Object.values(ActivityType).includes(type)) {
    errors.push(`Type must be one of: ${Object.values(ActivityType).join(', ')}`);
  }

  if (title !== undefined && typeof title !== 'string') {
    errors.push('Title must be a string');
  }

  const descText = description !== undefined ? description : content;
  if (descText !== undefined && (typeof descText !== 'string' || descText.trim().length === 0)) {
    errors.push('Description cannot be empty');
  }

  if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '') {
    if (!Types.ObjectId.isValid(assignedTo)) {
      errors.push('assignedTo must be a valid 24-character ObjectId');
    }
  }

  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    if (isNaN(Date.parse(dueDate))) {
      errors.push('dueDate must be a valid ISO date');
    }
  }

  if (status !== undefined && !Object.values(ActivityStatus).includes(status)) {
    errors.push(`Status must be one of: ${Object.values(ActivityStatus).join(', ')}`);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};
