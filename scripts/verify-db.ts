
import { getDb } from '../src/db';
import { jobs } from '../src/db/schema';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function verifyConnection() {
    console.log('🔌 Connecting to DB...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL missing in .env.local');
        process.exit(1);
    }

    try {
        const db = getDb();

        // Simple query to check connection
        const result = await db.execute(sql`SELECT NOW()`);
        console.log('✅ Connected! Server time:', result.rows[0]);

        // Check if tables exist (pseudo-check by selecting empty)
        const jobList = await db.select().from(jobs).limit(1);
        console.log('✅ Schema check passed. Jobs table accessible.');

        process.exit(0);
    } catch (error) {
        console.error('❌ DB Connection Failed:', error);
        process.exit(1);
    }
}

verifyConnection();
