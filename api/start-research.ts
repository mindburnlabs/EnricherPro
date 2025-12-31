import type { VercelRequest, VercelResponse } from '@vercel/node';

import { v4 as uuidv4 } from 'uuid';
import { RateLimiter } from './_lib/rateLimit.js';
import { getTenantId } from './_lib/context.js';

import { inngest } from './_lib/inngest.js';
import { db } from '../src/db/index.js';
import { jobs } from '../src/db/schema.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // Rate Limiting
    const ip = (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress || 'unknown';
    if (!RateLimiter.check(ip)) {
        return response.status(429).json({ error: 'Too Many Requests' });
    }

    if (!process.env.INNGEST_EVENT_KEY) {
        console.error("Missing INNGEST_EVENT_KEY");
        return response.status(500).json({ error: 'Configuration Error: Missing INNGEST_EVENT_KEY on server' });
    }

    try {
        const { input } = request.body;
        const tenantId = getTenantId(request);

        if (!input) {
            return response.status(400).json({ error: 'Missing input' });
        }

        const jobId = uuidv4();

        // 1. Create Job Record in DB (Critical: Must happen BEFORE Inngest trigger)
        try {
            await db.insert(jobs).values({
                id: jobId,
                tenantId,
                inputRaw: typeof input === 'string' ? input : JSON.stringify(input),
                status: 'pending',
                progress: 0,
                // meta: {
                //     mode: request.body.mode || 'balanced',
                //     initiatedBy: 'api'
                // }
            });
        } catch (dbError) {
            console.error("Failed to create job record:", dbError);
            return response.status(500).json({ error: 'Failed to initialize research job', details: String(dbError) });
        }

        // 2. Send event to Inngest
        try {
            await inngest.send({
                name: "app/research.started",
                data: {
                    jobId,
                    tenantId, // PASS TENANT ID
                    inputRaw: input,
                    forceRefresh: !!request.body.forceRefresh,
                    apiKeys: request.body.apiKeys || {},
                    agentConfig: request.body.agentConfig || {},
                    sourceConfig: request.body.sourceConfig || {},
                    budgets: request.body.budgets || {},
                    previousJobId: request.body.previousJobId || undefined,
                    mode: request.body.mode || 'balanced',
                },
            });
        } catch (inngestError) {
            console.error("Inngest Send Error:", inngestError);
            // Optional: Delete job if Inngest fails to prevent orphan pending jobs? 
            // For now, keep it as 'pending'/stuck is better than missing data.
            return response.status(500).json({ error: 'Failed to trigger workflow', details: String(inngestError) });
        }

        return response.status(200).json({ success: true, jobId });
    } catch (error) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
