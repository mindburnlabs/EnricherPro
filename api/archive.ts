
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let pool: any = null;

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { itemId } = request.body;
        if (!itemId) {
            return response.status(400).json({ error: 'Missing itemId' });
        }

        // Initialize pool if needed
        if (!pool) {
            const pg = require('pg');
            const { Pool } = pg;
            if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not defined');
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                max: 1,
            });
        }

        await pool.query(
            `UPDATE items SET status = 'archived' WHERE id = $1`,
            [itemId]
        );

        return response.status(200).json({ success: true, itemId });
    } catch (error: any) {
        console.error("Archive Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
