import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  CORS_ORIGINS: z.string().default('http://localhost:4173').refine(
    (value) => value.split(',').every((origin) => {
      try { new URL(origin.trim()); return true; } catch { return false; }
    }),
    'CORS_ORIGINS must be a comma-separated list of valid origins',
  ),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  JWT_ACCESS_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'Must be a base64-encoded 32-byte key'),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_DOMAIN: z.string().optional().or(z.literal('')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_SWAGGER: z.enum(['true', 'false']).default('false'),
  FRONTEND_URL: z.string().url().default('http://127.0.0.1:5500/frontend'),
  MAIL_PROVIDER: z.enum(['console', 'ses']).default('console'),
  MAIL_STRICT_DELIVERY: z.enum(['true', 'false']).default('false'),
  SES_REGION: z.string().optional().or(z.literal('')),
  SES_FROM_EMAIL: z.string().email().optional().or(z.literal('')),
  SES_FROM_NAME: z.string().min(1).max(80).default('YO STUDIOS'),
  SES_REPLY_TO: z.string().email().optional().or(z.literal('')),
  SES_CONFIGURATION_SET: z.string().optional().or(z.literal('')),
  SUPER_ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  SUPER_ADMIN_PASSWORD: z.string().min(18).optional().or(z.literal('')),
  GROW_API_URL: z.string().url().optional().or(z.literal('')),
  GROW_API_KEY: z.string().min(20).optional().or(z.literal('')),
  GROW_WEBHOOK_SECRET: z.string().min(32).optional().or(z.literal('')),
}).superRefine((value, context) => {
  if (value.MAIL_PROVIDER !== 'ses') return;
  if (!value.SES_REGION) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['SES_REGION'], message: 'SES_REGION is required when MAIL_PROVIDER=ses' });
  }
  if (!value.SES_FROM_EMAIL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['SES_FROM_EMAIL'], message: 'SES_FROM_EMAIL is required when MAIL_PROVIDER=ses' });
  }
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
