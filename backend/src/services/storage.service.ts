/**
 * Image storage on the local filesystem (outside application source).
 *
 * Security rules enforced here:
 *  - stored file names are always server-generated UUIDs;
 *  - the extension comes from sniffed content, never from client input;
 *  - reads are only allowed for names this module generated (path confined
 *    to the upload directory).
 */
import { promises as fs } from 'fs';
import path from 'path';

import { config } from '../config';
import { errors } from '../utils/errors';
import { extensionForMime, generateStorageName, sniffImageMime } from '../utils/filenames';
import { logger } from '../utils/logger';

export interface StoredImage {
  filename: string;
  mimeType: string;
  size: number;
}

async function ensureUploadDir(): Promise<string> {
  await fs.mkdir(config.uploads.directory, { recursive: true });
  return config.uploads.directory;
}

/** Validate content by magic bytes and persist under a generated name. */
export async function saveImage(buffer: Buffer, claimedMime?: string): Promise<StoredImage> {
  const sniffed = sniffImageMime(buffer);
  if (!sniffed || !extensionForMime(sniffed)) {
    throw errors.invalidImage(
      'Unsupported image format — please upload a JPEG, PNG or WebP image.',
    );
  }
  // The claimed type must not contradict the sniffed content type.
  if (claimedMime && claimedMime.split(';')[0].trim() !== sniffed) {
    logger.warn(
      { claimedMime, sniffed },
      'upload MIME mismatch — using sniffed content type',
    );
  }

  const directory = await ensureUploadDir();
  const filename = generateStorageName(sniffed);
  await fs.writeFile(path.join(directory, filename), buffer);
  return { filename, mimeType: sniffed, size: buffer.length };
}

export function imagePath(filename: string): string {
  // Server-generated names only — still normalise defensively.
  const resolved = path.resolve(config.uploads.directory, path.basename(filename));
  if (!resolved.startsWith(config.uploads.directory)) {
    throw errors.notFound();
  }
  return resolved;
}

export async function readImage(filename: string): Promise<Buffer> {
  try {
    return await fs.readFile(imagePath(filename));
  } catch {
    throw errors.notFound('The requested image was not found.');
  }
}

export async function deleteImage(filename: string): Promise<void> {
  try {
    await fs.unlink(imagePath(filename));
  } catch {
    // Best-effort cleanup — a missing file is not an error worth failing on.
  }
}

export async function writeBase64Image(base64Data: string, mimeType = 'image/jpeg'): Promise<StoredImage> {
  const buffer = Buffer.from(base64Data, 'base64');
  return saveImage(buffer, mimeType);
}
