import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/appError';
import { LeadSource, LeadStatus, LeadPriority } from '../models/lead.model';

export const validateCreateLead = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, source, status, priority, assignedTo } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Lead name is required');
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      errors.push('Please provide a valid email address');
    }
  }

  if (source && !Object.values(LeadSource).includes(source)) {
    errors.push(`Source must be one of: ${Object.values(LeadSource).join(', ')}`);
  }

  if (status && !Object.values(LeadStatus).includes(status)) {
    errors.push(`Status must be one of: ${Object.values(LeadStatus).join(', ')}`);
  }

  if (priority && !Object.values(LeadPriority).includes(priority)) {
    errors.push(`Priority must be one of: ${Object.values(LeadPriority).join(', ')}`);
  }

  if (assignedTo && !Types.ObjectId.isValid(assignedTo)) {
    errors.push('assignedTo must be a valid 24-character ObjectId');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateLead = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, source, status, priority, assignedTo } = req.body;
  const errors: string[] = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('Lead name cannot be empty');
  }

  if (email !== undefined && email !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      errors.push('Please provide a valid email address');
    }
  }

  if (source !== undefined && !Object.values(LeadSource).includes(source)) {
    errors.push(`Source must be one of: ${Object.values(LeadSource).join(', ')}`);
  }

  if (status !== undefined && !Object.values(LeadStatus).includes(status)) {
    errors.push(`Status must be one of: ${Object.values(LeadStatus).join(', ')}`);
  }

  if (priority !== undefined && !Object.values(LeadPriority).includes(priority)) {
    errors.push(`Priority must be one of: ${Object.values(LeadPriority).join(', ')}`);
  }

  if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '') {
    if (!Types.ObjectId.isValid(assignedTo)) {
      errors.push('assignedTo must be a valid 24-character ObjectId or null');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateLeadStatus = (req: Request, _res: Response, next: NextFunction): void => {
  const { status } = req.body;

  if (!status || !Object.values(LeadStatus).includes(status)) {
    return next(new AppError(`Status is required and must be one of: ${Object.values(LeadStatus).join(', ')}`, 400));
  }

  next();
};

export const validateLeadAssign = (req: Request, _res: Response, next: NextFunction): void => {
  const { assignedTo } = req.body;

  if (!assignedTo || !Types.ObjectId.isValid(assignedTo)) {
    return next(new AppError('assignedTo is required and must be a valid 24-character ObjectId', 400));
  }

  next();
};

export const validateLeadConvert = (req: Request, _res: Response, next: NextFunction): void => {
  const { dealValue, dealProbability, dealExpectedCloseDate } = req.body;
  const errors: string[] = [];

  if (dealValue === undefined || typeof dealValue !== 'number' || dealValue <= 0) {
    errors.push('dealValue is required and must be a number greater than 0');
  }

  if (dealProbability !== undefined) {
    if (typeof dealProbability !== 'number' || dealProbability < 0 || dealProbability > 100) {
      errors.push('dealProbability must be a number between 0 and 100');
    }
  }

  if (dealExpectedCloseDate !== undefined && dealExpectedCloseDate !== null) {
    const parsedDate = new Date(dealExpectedCloseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push('dealExpectedCloseDate must be a valid date');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateAddNote = (req: Request, _res: Response, next: NextFunction): void => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return next(new AppError('Note content is required and cannot be empty', 400));
  }

  next();
};
