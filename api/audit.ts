import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { auditLogs } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // --- GET: Fetch Recent Logs ---
    if (request.method === 'GET') {
      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50;

      const events = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);

      return response.status(200).json({ success: true, events });
    }

    // --- POST: Create Audit Log ---
    if (request.method === 'POST') {
      const {
        userId,
        action,
        entityType,
        entityId,
        reason,
        evidenceIds,
        beforeValue,
        afterValue,
      } = request.body;

      // Basic validation
      if (!userId || !action || !entityType || !entityId) {
        return response.status(400).json({ error: 'Missing required fields' });
      }

      await db.insert(auditLogs).values({
        userId,
        action,
        entityType,
        entityId,
        reason,
        evidenceIds,
        beforeValue,
        afterValue,
        timestamp: new Date(),
      });

      return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}
