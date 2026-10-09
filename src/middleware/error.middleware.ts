import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field '${err.path}': ${err.value}`;
  }

  // Handle Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `Duplicate value '${value}' for unique field '${field}'. Please use another value.`;
  }

  // Handle Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e: any) => e.message);
    message = `Validation Error: ${errors.join('. ')}`;
  }

  res.status(statusCode).json({
    success: false,
    status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404));
};
