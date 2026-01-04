import { db } from '../src/db/index.js';
import { jobs, skus } from '../src/db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { getTenantId } from './_lib/context.js';
import { v4 as uuidv4 } from 'uuid';
import { inngest } from './_lib/inngest.js';

export default async function handler(req: any, res: any) {
    // GET: List jobs
    if (req.method === 'GET') {
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

    // POST: Create new Enrichment Job
    if (req.method === 'POST') {
        try {
            const { supplier_string } = req.body;
            if (!supplier_string) {
                return res.status(400).json({ error: 'Missing supplier_string' });
            }

            const tenantId = getTenantId(req);
            const jobId = uuidv4();
            const skuId = uuidv4();

            // 1. Create SKU
            await db.insert(skus).values({
                id: skuId,
                supplierString: supplier_string,
                publishedChannels: [],
                blockedReasons: [],
            });

            // 2. Create Job
            await db.insert(jobs).values({
                id: jobId,
                tenantId,
                skuId, // Link!
                inputRaw: supplier_string,
                status: 'pending',
                progress: 0,
                startTime: new Date(),
                meta: { type: 'sku_enrichment' }
            });

            // 3. Trigger Inngest
            await inngest.send({
                name: "app/sku.enrichment.started",
                data: {
                    jobId,
                    skuId,
                    tenantId,
                    supplierString: supplier_string
                }
            });

            return res.status(200).json({ jobId, skuId });

        } catch (error) {
            console.error('Failed to create job:', error);
            return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
