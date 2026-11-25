/**
 * Government-portal authentication and authorization. Every official request
 * re-checks the database account, active status, role and session version.
 * A legacy citizen JWT is rejected by a separate key/issuer/token kind.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { getCivicRepository } from '../repositories/civic';
import { OFFICIAL_ROLES, OfficialRole } from '../types/civic';
import { errors } from '../utils/errors';
import { readCookie, safeTokenEquals } from '../utils/civic';
import { verifyOfficialToken } from '../utils/tokens';

export const OFFICIAL_SESSION_COOKIE = 'rdd_official_session';
export const OFFICIAL_CSRF_COOKIE = 'rdd_official_csrf';

function sessionToken(req: Request): string | null {
  const cookieToken = readCookie(req, OFFICIAL_SESSION_COOKIE);
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return null;
}

export const requireOfficialAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = sessionToken(req);
    if (!token) throw errors.unauthorized('Official authentication is required.');
    const payload = verifyOfficialToken(token);
    const official = await getCivicRepository().findOfficialById(payload.sub);
    if (
      !official ||
      official.email.toLowerCase() !== payload.email.toLowerCase() ||
      official.accountStatus !== 'ACTIVE' ||
      official.sessionVersion !== payload.sv
    ) {
      throw errors.invalidToken('The official session is no longer valid.');
    }
    req.officialAuth = {
      id: official.id,
      officialId: official.officialId,
      email: official.email,
      name: official.name,
      role: official.role,
      sessionVersion: official.sessionVersion,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export function requireOfficialRole(...roles: OfficialRole[]): RequestHandler {
  const allowed = roles.filter((role) => OFFICIAL_ROLES.includes(role));
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.officialAuth) {
      next(errors.unauthorized('Official authentication is required.'));
      return;
    }
    if (!allowed.includes(req.officialAuth.role)) {
      next(errors.forbidden('Your official role does not permit this action.'));
      return;
    }
    next();
  };
}

/** Double-submit CSRF token for cookie-authenticated state-changing requests. */
export const requireOfficialCsrf: RequestHandler = (req, _res, next) => {
  const cookieToken = readCookie(req, OFFICIAL_CSRF_COOKIE);
  const headerValue = req.headers['x-csrf-token'];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!safeTokenEquals(cookieToken, headerToken)) {
    next(errors.csrfRejected());
    return;
  }
  next();
};

export function officialOf(req: Request): NonNullable<Request['officialAuth']> {
  if (!req.officialAuth) throw errors.unauthorized('Official authentication is required.');
  return req.officialAuth;
}
