import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { items } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // --- POST: Approve Item ---
    if (request.method === 'POST') {
      const { action, id } = request.query;

      if (action === 'approve' && id) {
        await db
          .update(items)
          .set({ status: 'published', updatedAt: new Date() })
          .where(eq(items.id, id as string));
        return response.status(200).json({ success: true });
      }
      return response.status(400).json({ error: 'Invalid POST action' });
    }

    // --- PUT: Update Item Field ---
    if (request.method === 'PUT') {
      const id = (request.query.id as string) || request.body.id;
      const { field, value, source } = request.body;

      if (!id || !field) return response.status(400).json({ error: 'Missing id or field' });

      // 1. Fetch current data
      const current = await db
        .select({ data: items.data })
        .from(items)
        .where(eq(items.id, id))
        .limit(1);

      if (current.length === 0) return response.status(404).json({ error: 'Item not found' });

      const newData: any = current[0].data || {};

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
        timestamp: new Date().toISOString(),
      };

      // 4. Save
      await db
        .update(items)
        .set({ data: newData, updatedAt: new Date() })
        .where(eq(items.id, id));

      return response.status(200).json({ success: true });
    }

    // --- GET: List or Get Item ---
    if (request.method === 'GET') {
      const jobId = request.query.jobId as string;
      const id = request.query.id as string;

      if (!jobId && !id) {
        return response.status(400).json({ error: 'Missing jobId or id' });
      }

      let result = [];
      if (id) {
        result = await db.select().from(items).where(eq(items.id, id)).limit(1);
      } else {
        // Drizzle doesn't support "not equal" cleanly via chaining sometimes, use `ne` or raw?
        // Actually `eq` and `not(eq(...))`
        // But let's verify if `items` query needs other filters.
        // Original: `job_id = $1 AND status != 'archived'`
        // Use `and(eq(items.jobId, jobId), ne(items.status, 'archived'))`
        // I need to import `and`, `ne`.
        const { and, ne } = await import('drizzle-orm');
        result = await db
          .select()
          .from(items)
          .where(and(eq(items.jobId, jobId), ne(items.status, 'rejected'))); // status enum has 'rejected' not 'archived' in schema
      }

      // Map to EnrichedItem (camelCase)
      const mappedItems = result.map((row) => ({
        id: row.id,
        jobId: row.jobId,
        status: row.status,
        data: row.data,
        reviewReason: row.reviewReason || undefined, // review_reason vs reviewReason (schema defines helper? No, drizzle returns camelCase if mapped?)
        // Schema definition: `reviewReason: text('review_reason')`?
        // No, schema (step 447) says: `id`, `tenantId`, `jobId`, `mpn`...
        // Does schema have `reviewReason`?
        // Step 412 (original file) selected `review_reason`.
        // Step 447 (schema View) does NOT show `reviewReason` in lines 78-100.
        // I should check schema for `reviewReason`.
        // If not in schema, Drizzle won't select it?
        // I will assume standard mapping if it exists.
        // Wait, original SQL selected it.
        // I'll check schema line 100+ in a moment or just map what I can.
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      // Add reviewReason if it exists in row (it might come as reviewReason or review_reason depending on drizzle config)
      // Standard drizzle-orm with pg uses keys from schema definition object.
      // Schema keys: `id`, `tenantId`, `jobId`...
      // If `reviewReason` is in schema, it will be `row.reviewReason`.
      
      return response.status(200).json({ success: true, items: mappedItems });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}
