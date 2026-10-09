import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { UserRole } from '../models/user.model';
import { AppError } from '../utils/appError';

export const validateMongoId = (paramName: string = 'id') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const paramVal = req.params[paramName];
    const id = Array.isArray(paramVal) ? paramVal[0] : paramVal;
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid ${paramName}: '${id}'. Must be a valid 24-character hexadecimal ObjectId`, 400));
    }
    next();
  };
};

export const validateCreateUser = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, password, role, managerId, phone, isActive } = req.body;

  const errors: string[] = [];

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  // Password validation
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters long');
  }

  // Role validation
  const allowedRoles = Object.values(UserRole);
  if (!role || !allowedRoles.includes(role)) {
    errors.push(`Role is required and must be one of: ${allowedRoles.join(', ')}`);
  }

  // ManagerId validation
  if (managerId !== undefined && managerId !== null && managerId !== '') {
    if (!Types.ObjectId.isValid(managerId)) {
      errors.push('managerId must be a valid 24-character ObjectId');
    }
  }

  // Phone validation
  if (phone !== undefined && typeof phone !== 'string') {
    errors.push('Phone must be a string');
  }

  // isActive validation
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateUser = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, password, role, managerId, phone, isActive } = req.body;
  const errors: string[] = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('Name must be a non-empty string');
  }

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
      errors.push('Please provide a valid email address');
    }
  }

  if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
    errors.push('Password must be at least 6 characters long');
  }

  if (role !== undefined) {
    const allowedRoles = Object.values(UserRole);
    if (!allowedRoles.includes(role)) {
      errors.push(`Role must be one of: ${allowedRoles.join(', ')}`);
    }
  }

  if (managerId !== undefined && managerId !== null && managerId !== '') {
    if (!Types.ObjectId.isValid(managerId)) {
      errors.push('managerId must be a valid 24-character ObjectId or null');
    }
  }

  if (phone !== undefined && typeof phone !== 'string') {
    errors.push('Phone must be a string');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateStatus = (req: Request, _res: Response, next: NextFunction): void => {
  const { isActive } = req.body;

  if (isActive === undefined || typeof isActive !== 'boolean') {
    return next(new AppError("Field 'isActive' is required and must be a boolean (true or false)", 400));
  }

  next();
};
