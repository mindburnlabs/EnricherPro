import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('Checking Environment...');
  console.log('INNGEST_EVENT_KEY exists:', !!process.env.INNGEST_EVENT_KEY);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

  if (process.env.INNGEST_EVENT_KEY) {
    console.log(
      'INNGEST_EVENT_KEY value (first 5 chars):',
      process.env.INNGEST_EVENT_KEY.substring(0, 5) + '...',
    );
  }

  console.log('Checking DB Connection...');
  try {
    const res = await db.execute(sql`SELECT 1`);
    console.log('DB Connection Success:', res);
  } catch (e) {
    console.error('DB Connection Failed:', e);
  }
}

check();
