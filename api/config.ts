import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { systemConfig } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // GET: Fetch all config
    if (request.method === 'GET') {
      const allConfig = await db.select().from(systemConfig);
      const configMap: Record<string, any> = {};
      
      allConfig.forEach(row => {
        configMap[row.key] = row.value;
      });

      return response.status(200).json(configMap);
    }

    // POST: Update specific config key
    if (request.method === 'POST') {
      const { key, value } = request.body;

      if (!key || value === undefined) {
        return response.status(400).json({ error: 'Missing key or value' });
      }

      await db
        .insert(systemConfig)
        .values({
           key,
           value,
           updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: systemConfig.key,
          set: { 
            value, 
            updatedAt: new Date() 
          },
        });

      return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Config API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
