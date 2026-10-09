import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { UserRole } from '../models/user.model';
import { Types } from 'mongoose';

export const validateRegister = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, email, password, role, managerId } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters');
  }

  if (role !== undefined) {
    const allowedRoles = Object.values(UserRole);
    if (!allowedRoles.includes(role)) {
      errors.push(`Role must be one of: ${allowedRoles.join(', ')}`);
    }
  }

  if (managerId !== undefined && managerId !== null && managerId !== '') {
    if (!Types.ObjectId.isValid(managerId)) {
      errors.push('managerId must be a valid 24-character ObjectId');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateLogin = (req: Request, _res: Response, next: NextFunction): void => {
  const { email, password } = req.body;
  const errors: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateUpdateMe = (req: Request, _res: Response, next: NextFunction): void => {
  const { name, phone } = req.body;
  const errors: string[] = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('Name must be a non-empty string');
  }

  if (phone !== undefined && typeof phone !== 'string') {
    errors.push('Phone must be a string');
  }

  // Prevent restricted fields from being updated here
  if (req.body.role !== undefined || req.body.email !== undefined || req.body.isActive !== undefined) {
    errors.push('Updating role, email, or account status is not allowed via this endpoint');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};

export const validateChangePassword = (req: Request, _res: Response, next: NextFunction): void => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors: string[] = [];

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.push('Current password is required');
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    errors.push('New password is required and must be at least 6 characters long');
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    errors.push('New password and confirm password do not match');
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push('New password must be different from current password');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  next();
};
