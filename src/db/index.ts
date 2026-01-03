import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Singleton pattern for DB connection
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
    if (dbInstance) return dbInstance;

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not defined');
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10, // Adjust based on Vercel limits
    });

    dbInstance = drizzle(pool, { schema });
    return dbInstance;
};

// For direct import usage (lazy)
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;
export const db = new Proxy({} as DbInstance, {
    get: (_target, prop: keyof DbInstance) => {
        const instance = getDb();
        return instance[prop];
    },
});
