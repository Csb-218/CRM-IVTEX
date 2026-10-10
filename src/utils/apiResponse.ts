import { Response } from 'express';

export interface ApiResponseOptions<T> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const sendResponse = <T>({
  res,
  statusCode = 200,
  message = 'Success',
  data,
  pagination
}: ApiResponseOptions<T>): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(pagination && { pagination })
  });
};

export const getParamId = (paramVal: string | string[]): string =>
  Array.isArray(paramVal) ? paramVal[0] : paramVal;
