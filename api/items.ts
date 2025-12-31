import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let pool: any = null;

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const jobId = request.query.jobId as string;

        if (!jobId) {
            return response.status(400).json({ error: 'Missing jobId' });
        }

        // Initialize pool if needed
        if (!pool) {
            try {
                const pg = require('pg');
                const { Pool } = pg;

                if (!process.env.DATABASE_URL) {
                    throw new Error('DATABASE_URL is not defined');
                }

                pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    max: 1,
                    connectionTimeoutMillis: 5000,
                });
            } catch (e: any) {
                console.error("Failed to initialize DB pool:", e);
                return response.status(500).json({ error: 'Database Driver Error', details: e.message });
            }
        }

        let item;
        try {
            const res = await pool.query(
                `SELECT id, status, data, review_reason FROM items WHERE job_id = $1 LIMIT 1`,
                [jobId]
            );
            item = res.rows[0] || null;
        } catch (e: any) {
            console.error("Query Error:", e);
            return response.status(500).json({ error: 'Database Query Error', details: e.message });
        }

        const items = item ? [item] : [];

        return response.status(200).json({ success: true, items });
    } catch (error: any) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
