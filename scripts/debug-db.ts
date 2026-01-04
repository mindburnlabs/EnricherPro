import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('--- DB DEBUG ---');
console.log(
  'DATABASE_URL starts with:',
  process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'UNDEFINED',
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(
      'Tables in DB:',
      res.rows.map((r) => r.table_name),
    );
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    const activeHandles = process._getActiveHandles();
    const activeRequests = process._getActiveRequests();
    console.log(`Active handles: ${activeHandles.length}`);
    console.log(`Active requests: ${activeRequests.length}`);
    await pool.end();
  }
}

check();
