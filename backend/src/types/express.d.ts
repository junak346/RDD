/**
 * Express request augmentation — populated by the auth middleware.
 */
import { OfficialRole } from './civic';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authenticated legacy user (present only on protected routes). */
      auth?: {
        id: string;
        email: string;
        name: string;
        role: 'user' | 'inspector' | 'admin';
      };
      /** Authenticated government official, verified server-side on every request. */
      officialAuth?: {
        id: string;
        officialId: string;
        email: string;
        name: string;
        role: OfficialRole;
        sessionVersion: number;
      };
    }
  }
}

export {};
