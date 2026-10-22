import { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from './AppError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Route-param guard: non-UUID ids become a clean 404 instead of a database cast error. */
export function uuidParam(name: string, label = 'resource'): RequestHandler {
  return (req, _res, next) => {
    if (!isUuid(req.params[name])) return next(AppError.notFound(`This ${label} no longer exists`));
    next();
  };
}

/** Absolute API base for building image URLs that work from any client origin. */
export function apiBase(req: Request): string {
  return `${req.protocol}://${req.get('host')}/api`;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * In-memory multipart parser for photos. Files are re-encoded by `utils/images.ts` before storage,
 * so the raw upload never reaches the database.
 */
export function photoUpload(field: string, maxFiles: number, maxBytes = 8 * 1024 * 1024): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        return cb(AppError.badRequest('Only JPG, PNG and WebP images are allowed', 'INVALID_FILE_TYPE'));
      }
      cb(null, true);
    },
  });
  const handler = maxFiles === 1 ? upload.single(field) : upload.array(field, maxFiles);
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(AppError.badRequest(`Each photo must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB`, 'FILE_TOO_LARGE'));
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(AppError.badRequest(`You can upload up to ${maxFiles} photo${maxFiles === 1 ? '' : 's'}`, 'TOO_MANY_FILES'));
        }
      }
      next(err);
    });
  };
}

/** Long-lived, cache-friendly headers for immutable, versioned binary responses. */
export function sendImage(res: Response, mime: string, data: Buffer): void {
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // Images are loaded cross-origin by the web app; helmet defaults to same-origin.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(data);
}
