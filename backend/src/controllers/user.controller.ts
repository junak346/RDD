import { Request, Response } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/envelope';
import { userService } from '../services/user.service';

export const userController = {
  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateProfile(req.auth!.id, req.body);
    ok(res, { user });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await userService.listUsers(page, limit);
    ok(res, result);
  }),
};
