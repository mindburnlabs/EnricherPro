import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    try {
        await client.connect();
        console.log('🔌 Connected to DB');

        console.log('🚀 Enabling vector extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
        console.log('✅ Extension "vector" enabled successfully!');

    } catch (err) {
        console.error('❌ Error enabling vector extension:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
