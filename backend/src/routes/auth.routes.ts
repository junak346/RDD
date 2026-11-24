import { Router } from 'express';

import { authController } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.validators';
import { validate } from '../validators/common';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);
authRouter.get('/me', requireAuth, authController.me);
