import crypto from 'crypto';
import path from 'path';

/**
 * File-name safety helpers. User-supplied file names are NEVER used to build
 * filesystem paths — only generated UUIDs are, with an extension derived from
 * the *validated content type*, not from the client's claims.
 */

const SAFE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function extensionForMime(mime: string): string | null {
  return SAFE_EXTENSIONS[mime] ?? null;
}

/** Generate a collision-free storage name like `f3b9…c2.jpg`. */
export function generateStorageName(mime: string): string {
  const extension = extensionForMime(mime);
  if (!extension) {
    throw new Error(`Unsupported MIME type for storage: ${mime}`);
  }
  return `${crypto.randomUUID()}${extension}`;
}

/** Best-effort sanitisation for display purposes only (never used in paths). */
export function sanitizeDisplayName(name: string): string {
  return path
    .basename(name)
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 120);
}

/** Magic-byte signatures for the supported image formats. */
const SIGNATURES: Array<{ mime: string; test: (buffer: Buffer) => boolean }> = [
  {
    mime: 'image/jpeg',
    test: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mime: 'image/png',
    test: (buffer) =>
      buffer.length > 7 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47,
  },
  {
    mime: 'image/webp',
    test: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
];

/**
 * Determine the real image type from file content (never trust the client's
 * Content-Type or file extension). Returns null for anything unsupported.
 */
export function sniffImageMime(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (signature.test(buffer)) {
      return signature.mime;
    }
  }
  return null;
}
