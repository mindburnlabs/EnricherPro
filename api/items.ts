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
        const id = request.query.id as string;

        if (!jobId && !id) {
            return response.status(400).json({ error: 'Missing jobId or id' });
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

        let items = [];
        try {
            if (id) {
                const res = await pool.query(
                    `SELECT id, job_id, status, data, review_reason, created_at, updated_at FROM items WHERE id = $1 LIMIT 1`,
                    [id]
                );
                items = res.rows;
            } else {
                const res = await pool.query(
                    `SELECT id, job_id, status, data, review_reason, created_at, updated_at FROM items WHERE job_id = $1 AND status != 'archived'`,
                    [jobId]
                );
                items = res.rows;
            }
        } catch (e: any) {
            console.error("Query Error:", e);
            return response.status(500).json({ error: 'Database Query Error', details: e.message });
        }

        // Map to EnrichedItem (camelCase)
        const mappedItems = items.map((row: any) => ({
            id: row.id,
            jobId: row.job_id,
            status: row.status,
            data: row.data,
            reviewReason: row.review_reason,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        return response.status(200).json({ success: true, items: mappedItems });
    } catch (error: any) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
