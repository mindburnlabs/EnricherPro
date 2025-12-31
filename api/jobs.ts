import { db } from '../src/db';
import { jobs } from '../src/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getTenantId } from '../src/lib/context';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const tenantId = getTenantId(req);
        const limit = parseInt(req.query.limit as string) || 50;

        const recentJobs = await db.select()
            .from(jobs)
            .where(eq(jobs.tenantId, tenantId))
            .orderBy(desc(jobs.startTime))
            .limit(limit);

        return res.status(200).json({ jobs: recentJobs });
    } catch (error) {
        console.error('Failed to fetch jobs:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
