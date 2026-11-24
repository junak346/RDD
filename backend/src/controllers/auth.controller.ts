import { Request, Response } from 'express';

import { authService } from '../services/auth.service';
import { accepted, ok } from '../utils/envelope';
import { asyncHandler } from '../utils/asyncHandler';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    ok(res, result, 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    ok(res, result);
  }),

  logout: asyncHandler(async (_req: Request, res: Response) => {
    // Stateless JWT: the client discards its token. The architecture is ready
    // for a revocation list if hard logout becomes a requirement.
    ok(res, { message: 'Signed out.' });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.requestPasswordReset(req.body.email);
    accepted(res, {
      message: 'If an account exists for that email, a reset link has been sent.',
      // Present only when EXPOSE_RESET_TOKENS=true (dev/test, never production).
      ...(result.resetToken ? { resetToken: result.resetToken } : {}),
    });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    ok(res, { message: 'Password updated — you can now sign in.' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getProfile(req.auth!.id);
    ok(res, { user });
  }),
};
