import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/**
 * Operational application error with HTTP status code and machine-readable code.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wraps async Express route handlers to forward rejections to globalErrorHandler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handles unmatched API routes with a structured 404 AppError.
 */
export function notFoundHandler(req, res, next) {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

function normalizeError(err) {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));
    return new AppError('Validation failed. Please check the submitted fields.', 400, 'VALIDATION_ERROR', details);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return new AppError('Database validation failed.', 400, 'MONGOOSE_VALIDATION_ERROR', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return new AppError(`Invalid identifier format for ${err.path}.`, 400, 'INVALID_OBJECT_ID');
  }

  if (err?.code === 11000) {
    const keys = Object.keys(err.keyPattern || err.keyValue || {});
    const label = keys.length > 0 ? keys.join(', ') : 'unique field';
    return new AppError(`A record with this ${label} already exists.`, 409, 'DUPLICATE_KEY', err.keyValue);
  }

  if (err?.name === 'MulterError') {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image size exceeds the 5MB upload limit.'
        : err.message || 'File upload failed.';
    return new AppError(msg, 400, 'UPLOAD_ERROR');
  }

  if (err?.name === 'JsonWebTokenError') {
    return new AppError('Authentication token is invalid.', 401, 'INVALID_TOKEN');
  }

  if (err?.name === 'TokenExpiredError') {
    return new AppError('Session expired. Please sign in again.', 401, 'TOKEN_EXPIRED');
  }

  const statusCode = err?.statusCode || err?.status || 500;
  const message = err?.message || 'An unexpected server error occurred.';
  return new AppError(message, statusCode, err?.code || 'INTERNAL_SERVER_ERROR');
}

/**
 * Global Express error handling middleware returning standardized JSON payloads.
 */
export function globalErrorHandler(err, req, res, _next) {
  const normalized = normalizeError(err);

  if (normalized.statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  const payload = {
    success: false,
    message: normalized.message,
    code: normalized.code,
    ...(normalized.details ? { details: normalized.details } : {}),
    ...(!env.IS_PRODUCTION && normalized.statusCode >= 500 ? { stack: err.stack } : {}),
  };

  res.status(normalized.statusCode).json(payload);
}

export default globalErrorHandler;
