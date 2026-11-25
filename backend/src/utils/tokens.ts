import jwt from 'jsonwebtoken';

import { config } from '../config';
import { OFFICIAL_ROLES, OfficialRole } from '../types/civic';
import { errors } from './errors';

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: string;
}

export interface OfficialTokenPayload {
  kind: 'official';
  sub: string;
  email: string;
  role: OfficialRole;
  sv: number; // session version — lets logout invalidate issued tokens
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'rdd-backend',
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, { issuer: 'rdd-backend' });
    if (typeof decoded === 'string' || !decoded.sub) {
      throw errors.invalidToken();
    }
    return decoded as unknown as TokenPayload;
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw errors.invalidToken('The session has expired — please sign in again.');
    }
    throw errors.invalidToken();
  }
}

/** Official sessions use a different key and issuer from citizen accounts. */
export function signOfficialToken(payload: OfficialTokenPayload): string {
  return jwt.sign(payload, config.officialAuth.secret, {
    expiresIn: config.officialAuth.expiresIn,
    issuer: 'rdd-official-backend',
    audience: 'rdd-official-portal',
  } as jwt.SignOptions);
}

export function verifyOfficialToken(token: string): OfficialTokenPayload {
  try {
    const decoded = jwt.verify(token, config.officialAuth.secret, {
      issuer: 'rdd-official-backend',
      audience: 'rdd-official-portal',
    });
    if (
      typeof decoded === 'string' ||
      decoded.kind !== 'official' ||
      !decoded.sub ||
      !OFFICIAL_ROLES.includes(decoded.role as OfficialRole) ||
      typeof decoded.sv !== 'number'
    ) {
      throw errors.invalidToken();
    }
    return decoded as unknown as OfficialTokenPayload;
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw errors.invalidToken('The official session has expired — please sign in again.');
    }
    throw errors.invalidToken();
  }
}
