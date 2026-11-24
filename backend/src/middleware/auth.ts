/**
 * Authentication (Bearer JWT) and role-based authorization middleware.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { getRepositories } from '../repositories';
import { UserRole } from '../types/domain';
import { errors } from '../utils/errors';
import { verifyToken } from '../utils/tokens';

function extractToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw errors.unauthorized();
  }
  return header.slice('Bearer '.length).trim();
}

/** Attaches req.auth after verifying the token and account existence. */
export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);
    const payload = verifyToken(token);
    const user = await getRepositories().users.findById(payload.sub);
    if (!user) throw errors.invalidToken('The account for this session no longer exists.');

    req.auth = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

/** Restricts a route to specific roles (call after requireAuth). */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(errors.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(errors.forbidden('This action requires elevated permissions.'));
      return;
    }
    next();
  };
}

/** Convenience accessor for handlers that run behind requireAuth. */
export function authOf(req: Request): { id: string; email: string; name: string; role: UserRole } {
  if (!req.auth) throw errors.unauthorized();
  return req.auth;
}
