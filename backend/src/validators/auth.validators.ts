import { z } from 'zod';

import { isStrongPassword } from '../utils/passwords';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine(isStrongPassword, 'Password must contain letters and at least one number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('A valid email is required').max(254).toLowerCase(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (data) => (data.newPassword ? Boolean(data.currentPassword) : true),
    { message: 'currentPassword is required when setting a new password', path: ['currentPassword'] },
  );

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
