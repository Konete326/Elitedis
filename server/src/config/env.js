import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const nonEmpty = (name) =>
  z.string({ required_error: `${name} is required` }).trim().min(1, `${name} cannot be empty`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: nonEmpty('MONGODB_URI'),
  JWT_ACCESS_SECRET: nonEmpty('JWT_ACCESS_SECRET').min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: nonEmpty('JWT_REFRESH_SECRET').min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: nonEmpty('JWT_ACCESS_EXPIRES_IN').default('1d'),
  JWT_REFRESH_EXPIRES_IN: nonEmpty('JWT_REFRESH_EXPIRES_IN').default('7d'),
  SUPER_ADMIN_NAME: nonEmpty('SUPER_ADMIN_NAME'),
  SUPER_ADMIN_EMAIL: nonEmpty('SUPER_ADMIN_EMAIL').email('SUPER_ADMIN_EMAIL must be a valid email'),
  SUPER_ADMIN_PHONE: nonEmpty('SUPER_ADMIN_PHONE'),
  SUPER_ADMIN_PASSWORD: nonEmpty('SUPER_ADMIN_PASSWORD').min(8, 'SUPER_ADMIN_PASSWORD must be at least 8 characters'),
  DEFAULT_DISTRIBUTOR_CODE: nonEmpty('DEFAULT_DISTRIBUTOR_CODE'),
  DEFAULT_DISTRIBUTOR_NAME: nonEmpty('DEFAULT_DISTRIBUTOR_NAME'),
  CLOUDINARY_CLOUD_NAME: nonEmpty('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: nonEmpty('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: nonEmpty('CLOUDINARY_API_SECRET'),
  CLOUDINARY_ROOT_FOLDER: nonEmpty('CLOUDINARY_ROOT_FOLDER').default('elite_dist_erp'),
  CLIENT_URL: nonEmpty('CLIENT_URL'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formattedErrors = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'ENV'}: ${issue.message}`)
    .join('\n');
  console.error(`[ENV ERROR] Missing or invalid server environment configuration:\n${formattedErrors}`);
  process.exit(1);
}

/**
 * Frozen, validated backend environment configuration loaded from server/.env.
 */
export const env = Object.freeze({
  ...parsed.data,
  IS_PRODUCTION: parsed.data.NODE_ENV === 'production',
  CLIENT_ORIGINS: parsed.data.CLIENT_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});

export default env;
