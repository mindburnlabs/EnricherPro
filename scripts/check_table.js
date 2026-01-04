
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pkg;

async function check() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const db = drizzle(pool);

    try {
        console.log('Checking for table item_embeddings...');
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'item_embeddings'
            );
        `);
        console.log('Does table exist?', res.rows[0].exists);
        
        console.log('Listing all tables:');
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.table(tables.rows);

    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await pool.end();
    }
}

check();
