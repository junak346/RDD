/**
 * Email delivery abstraction.
 *
 * No third-party email provider is wired up (see docs/DEPLOYMENT.md —
 * "Plugging in an email provider"). The reset link is logged at info level
 * in development so the flow can be exercised end to end; the token itself
 * is never stored in plain text.
 */
import { config } from '../config';
import { logger } from '../utils/logger';

export interface PasswordResetEmail {
  to: string;
  resetUrl: string;
}

export const emailService = {
  sendPasswordReset(email: PasswordResetEmail): void {
    // Integration point: replace with SMTP / SES / Resend call in production.
    logger.info(
      { to: email.to, resetUrl: email.resetUrl },
      'password-reset link generated (email delivery simulated)',
    );
  },
};

export function buildResetUrl(token: string): string {
  return `${config.clientUrls[0] ?? 'http://localhost:5173'}/reset-password?token=${token}`;
}
