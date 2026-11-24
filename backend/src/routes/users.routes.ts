import { Router } from 'express';

import { userController } from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { updateProfileSchema } from '../validators/auth.validators';
import { paginationSchema, validate } from '../validators/common';

export const usersRouter = Router();

usersRouter.patch('/me', requireAuth, validate({ body: updateProfileSchema }), userController.updateMe);
usersRouter.get(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ query: paginationSchema }),
  userController.list,
);
