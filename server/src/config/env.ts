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
  SMTP_FROM: z.string().optional().default('"CodeK Academy" <no-reply@codek.local>')
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production' && data.CORS_ORIGIN === '*') {
      return false;
    }
    return true;
  },
  {
    message: 'In production mode, CORS_ORIGIN must be explicitly set to your frontend domain (cannot be "*")',
    path: ['CORS_ORIGIN']
  }
);

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
