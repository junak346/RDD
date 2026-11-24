/**
 * Express request augmentation — populated by the auth middleware.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authenticated user (present only on protected routes). */
      auth?: {
        id: string;
        email: string;
        name: string;
        role: 'user' | 'inspector' | 'admin';
      };
    }
  }
}

export {};
