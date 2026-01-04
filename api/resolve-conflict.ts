import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { items } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { itemId, resolution, targetId } = request.body;
        // resolution: 'keep_current' | 'replace' | 'merge'

        if (!itemId || !resolution) {
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (resolution === 'replace' && targetId) {
            // Archive target, Publish item
            await db.update(items).set({ status: 'rejected' }).where(eq(items.id, targetId)); // 'rejected' or 'archived' per schema? Schema has 'rejected'. Legacy had 'archived'. Using 'rejected'.
            await db.update(items).set({ status: 'published' }).where(eq(items.id, itemId));
        }
        else if (resolution === 'keep_current') {
            // Reject candidate
            await db.update(items).set({ status: 'rejected' }).where(eq(items.id, itemId));
        }
        else {
            // Default/Merge: Publish item
            await db.update(items).set({ status: 'published' }).where(eq(items.id, itemId));
        }

        return response.status(200).json({ success: true });
    } catch (error) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
