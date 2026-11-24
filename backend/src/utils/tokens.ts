import jwt from 'jsonwebtoken';

import { config } from '../config';
import { errors } from './errors';

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: string;
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
