/**
 * Response envelope helpers.
 *
 * Success:  { success: true, data, meta? }
 * Failure:  { success: false, error: { code, message, details? } }
 *
 * `meta` carries the active data mode so the frontend can show an honest
 * DEMO MODE banner whenever the in-memory demo store is active.
 */
import { Response } from 'express';

import { config } from '../config';

export interface ResponseMeta {
  dataMode: 'mongo' | 'demo';
  serverTime: string;
}

export function buildMeta(): ResponseMeta {
  return {
    dataMode: config.isDemoData ? 'demo' : 'mongo',
    serverTime: new Date().toISOString(),
  };
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data, meta: buildMeta() });
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function accepted<T>(res: Response, data: T): Response {
  return ok(res, data, 202);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
