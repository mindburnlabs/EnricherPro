
import pg from 'pg';
const { Pool } = pg;
import type { Pool as PoolType } from 'pg';

// Isolated DB client for API context - avoids src/ dependencies
let pool: PoolType | null = null;

export const getDb = () => {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not defined');
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 2, // Low max for serverless
        });
    }
    return pool;
};

// Helper to query single item by JobID
// Since we don't have Drizzle types here, we return any
export const getItemByJobId = async (jobId: string) => {
    const db = getDb();
    const res = await db.query(
        `SELECT id, status, data, review_reason FROM items WHERE job_id = $1 LIMIT 1`,
        [jobId]
    );
    return res.rows[0] || null;
};
