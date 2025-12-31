import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { itemId } = request.body;

        if (!itemId) {
            return response.status(400).json({ error: 'Missing itemId' });
        }

        const db = await getDb();
        await db.query(`UPDATE items SET status = 'published' WHERE id = $1`, [itemId]);

        return response.status(200).json({ success: true });
    } catch (error) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
