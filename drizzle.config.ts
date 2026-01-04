import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' });
}

if (!process.env.DATABASE_URL) {
  // Warn but don't fail, allowing for local usage without direct DB connection sometimes
  console.warn('⚠️ DATABASE_URL is not set in .env.local');
}

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
} satisfies Config;
