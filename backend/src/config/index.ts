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

// Use the raw environment for schema defaults that depend on the runtime mode.
const rawIsProduction = process.env.NODE_ENV?.toLowerCase() === 'production';

const booleanish = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value === undefined || value.trim() === ''
        ? fallback
        : ['1', 'true', 'yes'].includes(value.trim().toLowerCase()),
    );

// Planning defaults only — deployment operators define real service levels.
const DEFAULT_SLA_RULES = JSON.stringify({
  LOW: 168,
  MEDIUM: 96,
  HIGH: 48,
  CRITICAL: 24,
});

function parseSlaRules(raw: string): Record<string, number> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SLA_RULES_JSON must be a JSON object');
  }
  const rules: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^[A-Z_]+$/.test(key) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error('SLA_RULES_JSON values must be positive numbers of hours');
    }
    rules[key] = value;
  }
  return rules;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().default('mongodb://localhost:27017/rdd'),
  DATA_MODE: z.enum(['mongo', 'demo']).default('mongo'),
  DEMO_SEED: booleanish(false),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev-only-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Public ID, citizen capability and IP hashes use a separate HMAC key.
  HMAC_SECRET: z.string().min(16).optional(),
  OFFICIAL_JWT_SECRET: z.string().min(16).optional(),
  OFFICIAL_JWT_EXPIRES_IN: z.string().default('8h'),
  // Secure by default in production, but an explicit false is honoured for
  // the local HTTP-only Compose stack. Never disable this on a real deployment.
  OFFICIAL_COOKIE_SECURE: booleanish(rawIsProduction),
  OFFICIAL_LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  OFFICIAL_LOCKOUT_MINUTES: z.coerce.number().positive().default(15),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  UPLOAD_DIRECTORY: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(300),
  PUBLIC_REPORT_WINDOW_MINUTES: z.coerce.number().positive().default(60),
  PUBLIC_REPORT_MAX_REQUESTS: z.coerce.number().int().positive().default(8),
  PUBLIC_REPORT_IDENTICAL_LIMIT: z.coerce.number().int().positive().default(3),
  PUBLIC_REPORT_DAILY_IP_LIMIT: z.coerce.number().int().positive().default(20),
  PUBLIC_REPORT_ABUSE_WINDOW_MINUTES: z.coerce.number().positive().default(60),
  DUPLICATE_RADIUS_METERS: z.coerce.number().positive().default(75),
  DUPLICATE_WINDOW_MINUTES: z.coerce.number().positive().default(1440),
  MODEL_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
  MAX_LOCATION_ACCURACY_METERS: z.coerce.number().positive().default(10_000),
  MAX_LOCATION_AGE_MINUTES: z.coerce.number().positive().default(30),
  MAX_LOCATION_FUTURE_MINUTES: z.coerce.number().positive().default(5),
  SLA_RULES_JSON: z.string().default(DEFAULT_SLA_RULES),
  OFFICIAL_BOOTSTRAP_EMAIL: z.string().email().optional(),
  OFFICIAL_BOOTSTRAP_PASSWORD: z.string().optional(),
  OFFICIAL_BOOTSTRAP_NAME: z.string().optional(),
  OFFICIAL_BOOTSTRAP_DESIGNATION: z.string().optional(),
  OFFICIAL_BOOTSTRAP_DEPARTMENT: z.string().optional(),
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

// Production must not silently use development fallbacks or mixed-purpose keys.
if (
  isProduction &&
  (!process.env.JWT_SECRET ||
    !process.env.HMAC_SECRET ||
    !process.env.OFFICIAL_JWT_SECRET ||
    process.env.JWT_SECRET === process.env.OFFICIAL_JWT_SECRET ||
    process.env.HMAC_SECRET === process.env.JWT_SECRET ||
    process.env.HMAC_SECRET === process.env.OFFICIAL_JWT_SECRET)
) {
  // eslint-disable-next-line no-console
  console.error(
    'Production requires distinct JWT_SECRET, HMAC_SECRET and OFFICIAL_JWT_SECRET values.',
  );
  throw new Error('Invalid environment configuration');
}
if (isProduction && !env.OFFICIAL_COOKIE_SECURE) {
  // eslint-disable-next-line no-console
  console.warn('OFFICIAL_COOKIE_SECURE=false in production — only use for local HTTP smoke tests.');
}

try {
  parseSlaRules(env.SLA_RULES_JSON);
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Invalid SLA_RULES_JSON:', error instanceof Error ? error.message : error);
  throw new Error('Invalid environment configuration');
}

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
  /** Separate key for public IDs, citizen capabilities and IP hashes. */
  hmacSecret: env.HMAC_SECRET ?? `${env.JWT_SECRET}-public-hmac-v1`,
  officialAuth: {
    // Separate key/issuer from citizen accounts; never accept a citizen JWT.
    secret: env.OFFICIAL_JWT_SECRET ?? `${env.JWT_SECRET}-official-session-v1`,
    expiresIn: env.OFFICIAL_JWT_EXPIRES_IN,
    cookieSecure: env.OFFICIAL_COOKIE_SECURE,
    maxFailedLogins: env.OFFICIAL_LOGIN_MAX_FAILURES,
    lockoutMs: env.OFFICIAL_LOCKOUT_MINUTES * 60 * 1000,
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
  publicReports: {
    windowMs: env.PUBLIC_REPORT_WINDOW_MINUTES * 60 * 1000,
    max: env.PUBLIC_REPORT_MAX_REQUESTS,
    identicalLimit: env.PUBLIC_REPORT_IDENTICAL_LIMIT,
    dailyIpLimit: env.PUBLIC_REPORT_DAILY_IP_LIMIT,
    abuseWindowMs: env.PUBLIC_REPORT_ABUSE_WINDOW_MINUTES * 60 * 1000,
    duplicateRadiusMeters: env.DUPLICATE_RADIUS_METERS,
    duplicateWindowMs: env.DUPLICATE_WINDOW_MINUTES * 60 * 1000,
    maxLocationAccuracyMeters: env.MAX_LOCATION_ACCURACY_METERS,
    maxLocationAgeMs: env.MAX_LOCATION_AGE_MINUTES * 60 * 1000,
    maxLocationFutureMs: env.MAX_LOCATION_FUTURE_MINUTES * 60 * 1000,
  },
  /** Configured quality control gate; the AI service has its own matching setting. */
  modelConfidenceThreshold: env.MODEL_CONFIDENCE_THRESHOLD,
  /** Planning defaults, not an assertion of any real government SLA. */
  slaRules: parseSlaRules(env.SLA_RULES_JSON),
  officialBootstrap: env.OFFICIAL_BOOTSTRAP_EMAIL
    ? {
        email: env.OFFICIAL_BOOTSTRAP_EMAIL.toLowerCase(),
        password: env.OFFICIAL_BOOTSTRAP_PASSWORD ?? '',
        name: env.OFFICIAL_BOOTSTRAP_NAME ?? 'System Administrator',
        designation: env.OFFICIAL_BOOTSTRAP_DESIGNATION ?? 'System Administrator',
        department: env.OFFICIAL_BOOTSTRAP_DEPARTMENT ?? 'Public Works',
      }
    : null,
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
