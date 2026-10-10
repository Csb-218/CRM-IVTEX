import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/appError';
import { DealStage } from '../models/deal.model';

export const validateCreateDeal = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, customerId, leadId, assignedTo, value, probability, stage } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Deal name is required');
  }

  if (!customerId || !Types.ObjectId.isValid(customerId)) {
    errors.push('customerId is required and must be a valid 24-character ObjectId');
  }

  if (leadId && !Types.ObjectId.isValid(leadId)) {
    errors.push('leadId must be a valid 24-character ObjectId');
  }

  if (assignedTo && !Types.ObjectId.isValid(assignedTo)) {
    errors.push('assignedTo must be a valid 24-character ObjectId');
  }

  if (value === undefined || typeof value !== 'number' || value <= 0) {
    errors.push('Deal value is required and must be greater than 0');
  }

  if (probability !== undefined) {
    if (typeof probability !== 'number' || probability < 0 || probability > 100) {
      errors.push('Probability must be a number between 0 and 100');
    }
  }

  if (stage && !Object.values(DealStage).includes(stage)) {
    errors.push(`Stage must be one of: ${Object.values(DealStage).join(', ')}`);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateDeal = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, value, probability, expectedCloseDate, customerId, assignedTo } = req.body;
  const errors: string[] = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('Deal name cannot be empty');
  }

  if (customerId !== undefined && !Types.ObjectId.isValid(customerId)) {
    errors.push('customerId must be a valid 24-character ObjectId');
  }

  if (assignedTo !== undefined && !Types.ObjectId.isValid(assignedTo)) {
    errors.push('assignedTo must be a valid 24-character ObjectId');
  }

  if (value !== undefined && (typeof value !== 'number' || value <= 0)) {
    errors.push('Deal value must be greater than 0');
  }

  if (probability !== undefined && (typeof probability !== 'number' || probability < 0 || probability > 100)) {
    errors.push('Probability must be between 0 and 100');
  }

  if (expectedCloseDate !== undefined && expectedCloseDate !== null) {
    const parsedDate = new Date(expectedCloseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push('expectedCloseDate must be a valid date');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateDealStage = (req: Request, _res: Response, next: NextFunction): void => {
  const { stage, lostReason, expectedCloseDate } = req.body;
  const errors: string[] = [];

  if (!stage || !Object.values(DealStage).includes(stage)) {
    errors.push(`Stage is required and must be one of: ${Object.values(DealStage).join(', ')}`);
  }

  if (stage === DealStage.LOST) {
    if (!lostReason || typeof lostReason !== 'string' || lostReason.trim().length === 0) {
      errors.push("Field 'lostReason' is required when deal stage is set to 'lost'");
    }
  }

  if (expectedCloseDate !== undefined && expectedCloseDate !== null) {
    const parsedDate = new Date(expectedCloseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push('expectedCloseDate must be a valid date');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateDealAssign = (req: Request, _res: Response, next: NextFunction): void => {
  const { assignedTo } = req.body;

  if (!assignedTo || !Types.ObjectId.isValid(assignedTo)) {
    return next(new AppError('assignedTo is required and must be a valid 24-character ObjectId', 400));
  }

  next();
};
