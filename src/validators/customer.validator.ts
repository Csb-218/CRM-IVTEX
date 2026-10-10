import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/appError';
import { CustomerStatus } from '../models/customer.model';

export const validateCreateCustomer = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, assignedTo, status } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Customer name is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid customer email is required');
  }

  if (assignedTo && !Types.ObjectId.isValid(assignedTo)) {
    errors.push('assignedTo must be a valid 24-character ObjectId');
  }

  if (status && !Object.values(CustomerStatus).includes(status)) {
    errors.push(`Status must be one of: ${Object.values(CustomerStatus).join(', ')}`);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateCustomer = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, assignedTo, status } = req.body;
  const errors: string[] = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('Customer name cannot be empty');
  }

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      errors.push('Please provide a valid email address');
    }
  }

  if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '') {
    if (!Types.ObjectId.isValid(assignedTo)) {
      errors.push('assignedTo must be a valid 24-character ObjectId or null');
    }
  }

  if (status !== undefined && !Object.values(CustomerStatus).includes(status)) {
    errors.push(`Status must be one of: ${Object.values(CustomerStatus).join(', ')}`);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};
