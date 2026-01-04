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
      const id = request.query.id as string;

      let query = `
                SELECT 
                    j.id, 
                    j.input_raw, 
                    j.status, 
                    j.progress, 
                    j.start_time as "startTime", 
                    j.end_time as "endTime",
                    (SELECT COUNT(*) FROM items i WHERE i.job_id = j.id) as "itemCount",
                    (SELECT mpn FROM items i WHERE i.job_id = j.id LIMIT 1) as "firstMpn",
                    (SELECT COALESCE(SUM(cost_usd), 0) FROM model_usage mu WHERE mu.job_id = j.id) as "cost",
                    (SELECT COALESCE(SUM(total_tokens), 0) FROM model_usage mu WHERE mu.job_id = j.id) as "tokenUsage"
                FROM jobs j
            `;
            
      const params = [];
      if (id) {
        query += ` WHERE j.id = $1`;
        params.push(id);
      } else {
        query += ` ORDER BY j.start_time DESC LIMIT $1`;
        params.push(limit);
      }

      const res = await pool.query(query, params);

      // Cast cost to number (postgres returns numeric as string)
      const jobs = res.rows.map((r: any) => ({
        ...r,
        cost: parseFloat(r.cost),
        tokenUsage: parseInt(r.tokenUsage)
      }));

      return response.status(200).json({ success: true, jobs });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}
