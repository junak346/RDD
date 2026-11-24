/**
 * Multer configuration for image uploads.
 *
 * Files are buffered in memory briefly so magic-byte sniffing can validate
 * real content before anything touches the filesystem (see
 * services/storage.service.ts). Original client filenames are never used
 * for storage.
 */
import { Request } from 'express';
import multer from 'multer';

import { config } from '../config';
import { errors } from '../utils/errors';

const ALLOWED_FIELD_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

export const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploads.maxBytes,
    files: 1,
    fields: 8,
  },
  fileFilter(_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) {
    // Cheap first gate on the declared type; real content is sniffed later.
    if (!ALLOWED_FIELD_MIMES.has(file.mimetype.toLowerCase())) {
      callback(errors.invalidImage('Only JPEG, PNG and WebP images are supported.'));
      return;
    }
    callback(null, true);
  },
}).single('image');
