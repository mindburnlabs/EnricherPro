import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let pool: any = null;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!pool) {
    try {
      const pg = require('pg');
      const { Pool } = pg;
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not defined');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
    } catch (e: any) {
      return response.status(500).json({ error: 'Database Driver Error', details: e.message });
    }
  }

  try {
    if (request.method === 'GET') {
      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50;

      // Fetch jobs with some stats
      const res = await pool.query(
        `
                SELECT 
                    j.id, 
                    j.input_raw, 
                    j.status, 
                    j.progress, 
                    j.start_time as "startTime", 
                    j.end_time as "endTime",
                    (SELECT COUNT(*) FROM items i WHERE i.job_id = j.id) as "itemCount",
                    (SELECT mpn FROM items i WHERE i.job_id = j.id LIMIT 1) as "firstMpn"
                FROM jobs j
                ORDER BY j.start_time DESC
                LIMIT $1
            `,
        [limit],
      );

      return response.status(200).json({ success: true, jobs: res.rows });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}
