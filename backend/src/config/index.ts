/**
 * Central configuration, loaded once from the environment.
 * Validation fails fast on misconfiguration — see .env.example.
 */
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load the repository-root .env when running from backend/ (dev convenience).
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // then backend/.env if present

const booleanish = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value.trim() === ''
        ? fallback
        : ['1', 'true', 'yes'].includes(value.trim().toLowerCase()),
    );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().default('mongodb://localhost:27017/rdd'),
  DATA_MODE: z.enum(['mongo', 'demo']).default('mongo'),
  DEMO_SEED: booleanish(false),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev-only-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  UPLOAD_DIRECTORY: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(300),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  ADMIN_EMAILS: z.string().default(''),
  // Dev/test only: allows tests and local demos to capture password-reset tokens
  // without an email provider. Forced OFF in production (see config export).
  EXPOSE_RESET_TOKENS: booleanish(false),
  AI_TIMEOUT_MS: z.coerce.number().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const env = parsed.data;
const isProduction = env.NODE_ENV === 'production';

export const config = {
  env: env.NODE_ENV,
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  /** "mongo" = production store; "demo" = explicitly-labelled in-memory store. */
  dataMode: env.DATA_MODE,
  isDemoData: env.DATA_MODE === 'demo',
  demoSeed: env.DEMO_SEED,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  aiServiceUrl: env.AI_SERVICE_URL.replace(/\/$/, ''),
  aiTimeoutMs: env.AI_TIMEOUT_MS,
  uploads: {
    directory: path.resolve(process.cwd(), env.UPLOAD_DIRECTORY),
    maxBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: Math.min(20, env.RATE_LIMIT_MAX_REQUESTS),
  },
  logLevel: env.LOG_LEVEL,
  clientUrls: env.CLIENT_URL.split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  adminEmails: env.ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  /** Never true in production — see EXPOSE_RESET_TOKENS. */
  exposeResetTokens: env.EXPOSE_RESET_TOKENS && !isProduction,
} as const;

export type AppConfig = typeof config;
