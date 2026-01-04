import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Lazy cache for the pool to survive hot reloads if possible
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
          max: 1, // Conservative connection limit
          connectionTimeoutMillis: 5000,
        });
      } catch (e: any) {
        console.error('Failed to initialize DB pool:', e);
        return response.status(500).json({ error: 'Database Driver Error', details: e.message });
      }
    }

    // Execute Query
    let item;
    try {
      const res = await pool.query(
        `SELECT id, status, data, review_reason FROM items WHERE job_id = $1 LIMIT 1`,
        [jobId],
      );
      item = res.rows[0] || null;
    } catch (e: any) {
      console.error('Query Error:', e);
      return response.status(500).json({ error: 'Database Query Error', details: e.message });
    }

    if (!item) {
      return response.status(200).json({ status: 'pending', steps: [] });
    }

    // Map DB status to UI steps
    const steps = [];

    if (item.status === 'processing') {
      steps.push({ id: 'research', label: 'status.searching', status: 'running' });
    } else if (item.status === 'needs_review') {
      steps.push({ id: 'research_done', label: 'status.complete', status: 'completed' });
      steps.push({
        id: 'review',
        label: 'status.review_required',
        status: 'running',
        message: item.review_reason,
      });
    } else if (item.status === 'published') {
      steps.push({ id: 'research_done', label: 'status.complete', status: 'completed' });
      steps.push({ id: 'published', label: 'status.published', status: 'completed' });
    }

    return response.status(200).json({
      status: item.status,
      steps,
      result: item.data,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}
