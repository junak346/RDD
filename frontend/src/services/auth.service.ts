import { apiGet, apiPatch, apiPost } from './api';
import { User } from '../types';

export const accountService = {
  async updateProfile(input: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<User> {
    const data = await apiPatch<{ user: User }>('/users/me', input);
    return data.user;
  },

  forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    return apiPost('/auth/forgot-password', { email });
  },

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return apiPost('/auth/reset-password', { token, password });
  },

  health() {
    return apiGet<import('../types').HealthStatus>('/health');
  },
};
