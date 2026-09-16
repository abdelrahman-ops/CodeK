import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('*'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email().optional().default('admin@codek.local'),
  ADMIN_LOGIN_ID: z.string().optional().default('ADM-001'),
  ADMIN_NAME: z.string().optional().default('Abdelrahman Ataa'),
  ADMIN_PASSWORD: z.string().optional().default('Admin@123456'),
  // SMTP Email Provider Configuration
  SMTP_HOST: z.string().optional().transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_SECURE: z.coerce.boolean().optional().default(false),
  SMTP_USER: z.string().optional().transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  SMTP_PASS: z.string().optional().transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  SMTP_FROM: z.string().optional().default('"CodeK Academy" <no-reply@codek.local>'),
  // Cookie Configuration
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  // Database Pool Configuration
  DB_POOL_MAX: z.coerce.number().min(1).default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().min(1000).default(5000),
  // Video Provider Configuration
  VIDEO_PROVIDER: z.string().optional().default(''),
  CLOUDFLARE_STREAM_ACCOUNT_ID: z.string().optional().default(''),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().optional().default(''),
  CLOUDFLARE_STREAM_KEY_ID: z.string().optional().default(''),
  CLOUDFLARE_STREAM_KEY_PEM: z.string().optional().default(''),
  MUX_TOKEN_ID: z.string().optional().default(''),
  MUX_TOKEN_SECRET: z.string().optional().default(''),
  MUX_SIGNING_KEY_ID: z.string().optional().default(''),
  MUX_SIGNING_PRIVATE_KEY: z
    .string()
    .optional()
    .default('')
    .transform((val) => {
      if (!val) return '';
      // Support escaped literal newlines in .env files
      let normalized = val.replace(/\\n/g, '\n');
      // If it's a raw base64 string without PEM headers, decode it if appropriate
      if (normalized.startsWith('-----BEGIN') || !normalized.includes('\n')) {
        try {
          // If it looks like pure base64 without headers, check if base64-decoded string has PEM headers
          if (!normalized.includes('-----BEGIN')) {
            const decoded = Buffer.from(normalized, 'base64').toString('utf8');
            if (decoded.includes('-----BEGIN')) {
              normalized = decoded;
            }
          }
        } catch {
          // Keep original string if base64 decoding fails
        }
      }
      return normalized;
    }),
  MUX_WEBHOOK_SECRET: z.string().optional().default(''),
  // Payment Provider Configuration
  PAYMENT_PROVIDER: z.string().default('paymob'),
  PAYMOB_SECRET_KEY: z.string().optional().default(''),
  PAYMOB_PUBLIC_KEY: z.string().optional().default(''),
  PAYMOB_HMAC_SECRET: z.string().optional().default(''),
  PAYMOB_INTEGRATION_ID_CARD: z.string().optional().default(''),
  PAYMOB_INTEGRATION_ID_WALLET: z.string().optional().default(''),
  PAYMOB_API_BASE: z.string().default('https://accept.paymob.com'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    // 1. In production, wildcard CORS with credentials is fundamentally insecure
    if (data.CORS_ORIGIN === '*' || data.CORS_ORIGIN.split(',').map(s => s.trim()).includes('*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN cannot be wildcard (*) in production. Specify exact comma-separated domain origins.'
      });
    }

    // 2. In production, JWT secrets must be distinct and sufficiently strong
    if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must be different from JWT_SECRET in production.'
      });
    }

    // 3. If Paymob is active in production, required secrets must be supplied
    if (data.PAYMENT_PROVIDER === 'paymob') {
      if (!data.PAYMOB_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYMOB_SECRET_KEY'],
          message: 'PAYMOB_SECRET_KEY is required in production when PAYMENT_PROVIDER is paymob.'
        });
      }
      if (!data.PAYMOB_HMAC_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYMOB_HMAC_SECRET'],
          message: 'PAYMOB_HMAC_SECRET is required in production when PAYMENT_PROVIDER is paymob.'
        });
      }
    }

    // 4. If Mux is active in production, required secrets must be supplied
    if (data.VIDEO_PROVIDER.toUpperCase().includes('MUX')) {
      if (!data.MUX_TOKEN_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MUX_TOKEN_ID'],
          message: 'MUX_TOKEN_ID is required in production when VIDEO_PROVIDER is MUX.'
        });
      }
      if (!data.MUX_TOKEN_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MUX_TOKEN_SECRET'],
          message: 'MUX_TOKEN_SECRET is required in production when VIDEO_PROVIDER is MUX.'
        });
      }
      if (!data.MUX_SIGNING_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MUX_SIGNING_KEY_ID'],
          message: 'MUX_SIGNING_KEY_ID is required in production for secure signed playback.'
        });
      }
      if (!data.MUX_SIGNING_PRIVATE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MUX_SIGNING_PRIVATE_KEY'],
          message: 'MUX_SIGNING_PRIVATE_KEY is required in production for secure signed playback.'
        });
      }
      if (!data.MUX_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MUX_WEBHOOK_SECRET'],
          message: 'MUX_WEBHOOK_SECRET is required in production to verify Mux webhooks.'
        });
      }
    }
  }
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
