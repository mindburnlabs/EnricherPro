import { db } from '../src/db/index.js';
import { jobs, jobEvents, items } from '../src/db/schema.js';
import { count, eq, like, desc } from 'drizzle-orm';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [totalJobs] = await db.select({ count: count() }).from(jobs);
    const [totalItems] = await db.select({ count: count() }).from(items);

    // Count Firecrawl searches (heuristic: logs containing "Executing query")
    const [totalSearches] = await db
      .select({ count: count() })
      .from(jobEvents)
      .where(like(jobEvents.message, '%Executing query%'));

    // Count LLM calls (heuristic: logs containing "Planning" or "Synthesizing" or "Extraction")
    // This is rough approximation
    const [totalLLM] = await db
      .select({ count: count() })
      .from(jobEvents)
      .where(like(jobEvents.message, '%Planning%')); // + Extract calls?

    return res.status(200).json({
      jobs: totalJobs.count,
      items: totalItems.count,
      searches: totalSearches.count,
      llm_ops: totalLLM.count,
    });
  } catch (e) {
    console.error('Stats Error', e);
    return res.status(500).json({ error: 'Stats failed' });
  }
}
