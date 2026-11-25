/**
 * Storage abstraction for citizen-captured images. The local implementation
 * reuses the existing content-sniffing storage service; a future S3-compatible
 * adapter can implement this small interface without touching report services.
 * No public URL is derived from a stored filename.
 */
import { StoredImage, deleteImage, readImage, saveImage } from './storage.service';

export interface ReportImageStorage {
  readonly kind: 'local' | 'object';
  save(buffer: Buffer, claimedMime?: string): Promise<StoredImage>;
  read(filename: string): Promise<Buffer>;
  remove(filename: string): Promise<void>;
}

export const localReportImageStorage: ReportImageStorage = {
  kind: 'local',
  save: saveImage,
  read: readImage,
  remove: deleteImage,
};

let activeStorage: ReportImageStorage = localReportImageStorage;

export function getReportImageStorage(): ReportImageStorage {
  return activeStorage;
}

/** Extension point for cloud adapters; never exposed through public APIs. */
export function setReportImageStorage(storage: ReportImageStorage): void {
  activeStorage = storage;
}
