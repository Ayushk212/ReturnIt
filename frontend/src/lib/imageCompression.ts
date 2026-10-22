/**
 * Browser-side photo compression before upload.
 *
 * Phone photos are often 4–12 MB. Resizing to at most 2048px on the longest edge and re-encoding
 * as WebP (JPEG where WebP encoding is unavailable) usually brings them under 500 KB, which keeps
 * uploads fast on mobile data. The server re-encodes every image again (and strips location
 * metadata), so this step is an optimisation, never a security boundary.
 */
export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  /** Files already smaller than this, and within maxEdge, are uploaded unchanged. */
  skipBelowBytes?: number;
}

export interface CompressedPhoto {
  file: File;
  originalBytes: number;
  bytes: number;
  width: number;
  height: number;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // `from-image` honours EXIF orientation, so portrait phone photos stay upright.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> decoding below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<CompressedPhoto> {
  const maxEdge = opts.maxEdge ?? 2048;
  const quality = opts.quality ?? 0.85;
  const skipBelow = opts.skipBelowBytes ?? 350 * 1024;

  const source = await decode(file);
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!w || !h) throw new Error('This file could not be read as an image.');

  const scale = Math.min(1, maxEdge / Math.max(w, h));
  if (scale === 1 && file.size <= skipBelow) {
    if ('close' in source) source.close();
    return { file, originalBytes: file.size, bytes: file.size, width: w, height: h };
  }

  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();

  // Safari before 17 cannot encode WebP and silently returns PNG; detect that and use JPEG.
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  if (!blob) throw new Error('Your browser could not process this image.');

  // Keep the original if re-encoding did not actually help.
  if (blob.size >= file.size && scale === 1) {
    return { file, originalBytes: file.size, bytes: file.size, width: w, height: h };
  }
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${ext}`;
  return {
    file: new File([blob], name, { type: blob.type, lastModified: Date.now() }),
    originalBytes: file.size,
    bytes: blob.size,
    width,
    height,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
