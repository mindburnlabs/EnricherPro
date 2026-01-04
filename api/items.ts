import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let pool: any = null;

export default async function handler(request: VercelRequest, response: VercelResponse) {
    
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

    try {
        // --- POST: Approve Item ---
        if (request.method === 'POST') {
             const { action, id } = request.query;

             if (action === 'approve' && id) {
                 await pool.query("UPDATE items SET status = 'published', updated_at = NOW() WHERE id = $1", [id]);
                 return response.status(200).json({ success: true });
             }
             return response.status(400).json({ error: "Invalid POST action" });
        }

        // --- PUT: Update Item Field ---
        if (request.method === 'PUT') {
             // Support ID via query (standard for this app) or body
             const id = (request.query.id as string) || request.body.id;
             const { field, value, source } = request.body;

             if (!id || !field) return response.status(400).json({ error: "Missing id or field" });

             // 1. Fetch current data
             const current = await pool.query("SELECT data FROM items WHERE id = $1", [id]);
             if (current.rows.length === 0) return response.status(404).json({ error: "Item not found" });

             let newData = current.rows[0].data || {};
             
             // 2. Update nested field (basic support)
             const parts = field.split('.');
             if (parts.length === 1) {
                 newData[parts[0]] = value;
             } else if (parts.length === 2) {
                 if (!newData[parts[0]]) newData[parts[0]] = {};
                 newData[parts[0]][parts[1]] = value;
             }
             
             // 3. Mark evidence as manually verified
             if (!newData._evidence) newData._evidence = {};
             newData._evidence[field] = {
                 value: value,
                 source_url: source || 'manual_override',
                 confidence: 1.0,
                 method: 'manual',
                 timestamp: new Date().toISOString()
             };

             // 4. Save
             await pool.query("UPDATE items SET data = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(newData), id]);
             return response.status(200).json({ success: true });
        }

        // --- GET: List or Get Item ---
        if (request.method === 'GET') {
            const jobId = request.query.jobId as string;
            const id = request.query.id as string;

            if (!jobId && !id) {
                return response.status(400).json({ error: 'Missing jobId or id' });
            }

            let items = [];
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
        }

        return response.status(405).json({ error: 'Method Not Allowed' });

    } catch (error: any) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
