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

      // Fetch audit logs OR job events if audit logs are empty
      const res = await pool.query(
        `
                SELECT 
                    id, 
                    user_id as "userId", 
                    action, 
                    entity_type as "entityType", 
                    entity_id as "entityId", 
                    reason, 
                    timestamp,
                    before_value as "before",
                    after_value as "after"
                FROM audit_log
                ORDER BY timestamp DESC
                LIMIT $1
            `,
        [limit],
      );

      return response.status(200).json({ success: true, events: res.rows });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}
