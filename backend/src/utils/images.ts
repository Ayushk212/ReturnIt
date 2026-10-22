import sharp from 'sharp';
import { AppError } from './AppError.js';

/**
 * All uploaded photos are re-encoded on the server, regardless of what the browser sent:
 * - decoded and auto-rotated using EXIF orientation;
 * - metadata (including GPS location) stripped;
 * - resized to fit within a maximum edge, never enlarged;
 * - stored as WebP, which is typically 25 to 35 percent smaller than JPEG at the same quality.
 * Re-encoding also rejects files that only pretend to be images.
 */
const LISTING_MAX_EDGE = 1600;
const THUMB_MAX_EDGE = 480;
const AVATAR_EDGE = 320;
const MAX_INPUT_PIXELS = 40_000_000; // guards against decompression bombs

export interface ProcessedImage {
  data: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  mime: 'image/webp';
}

async function decode(input: Buffer) {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw new Error('No dimensions');
    return image;
  } catch {
    throw AppError.badRequest('One of the photos could not be read. Please use a JPG, PNG or WebP image.', 'INVALID_IMAGE');
  }
}

export async function processListingImage(input: Buffer): Promise<ProcessedImage> {
  const image = await decode(input);
  const { data, info } = await image
    .clone()
    .resize({ width: LISTING_MAX_EDGE, height: LISTING_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await image
    .clone()
    .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();
  return { data, thumb, width: info.width, height: info.height, mime: 'image/webp' };
}

export async function processAvatar(input: Buffer): Promise<{ data: Buffer; mime: 'image/webp' }> {
  const image = await decode(input);
  const data = await image
    .resize({ width: AVATAR_EDGE, height: AVATAR_EDGE, fit: 'cover', position: 'attention' })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  return { data, mime: 'image/webp' };
}
