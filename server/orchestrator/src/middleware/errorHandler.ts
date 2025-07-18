import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Request error', {
    error: err,
    statusCode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    stack: err.stack
  });

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      details: err.details,
      timestamp: new Date().toISOString()
    }
  });
}