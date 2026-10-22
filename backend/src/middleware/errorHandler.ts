import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { ApiErrorEnvelope } from '@returnit/shared';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = (req.headers['x-request-id'] as string) || (req as unknown as { id?: string }).id;

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
    // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    const pgCode = (err as { code: string }).code;
    if (pgCode === '22P02') {
      statusCode = 400;
      code = 'INVALID_ID';
      message = 'Invalid resource identifier format';
    } else if (pgCode === '23505') {
      statusCode = 409;
      code = 'DUPLICATE_RESOURCE';
      message = 'This has already been submitted';
    } else if (pgCode === '23503') {
      statusCode = 409;
      code = 'REFERENCE_MISSING';
      message = 'A related record no longer exists';
    }
  }

  // Log error with requestId
  if (statusCode >= 500) {
    logger.error({ err, requestId, path: req.path, method: req.method }, message);
  } else {
    logger.warn({ statusCode, code, message, requestId, path: req.path }, 'Client operational error');
  }

  const responseBody: ApiErrorEnvelope = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };

  res.status(statusCode).json(responseBody);
};
