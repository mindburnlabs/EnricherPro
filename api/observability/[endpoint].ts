import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObservabilityService } from '../../src/services/backend/ObservabilityService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { endpoint } = req.query;
    const tenantId = (req.query.tenantId as string) || 'default';
    const days = parseInt((req.query.days as string) || '7', 10);

    try {
        switch (endpoint) {
            case 'total-spend':
                const spend = await ObservabilityService.getTotalSpend(tenantId, days);
                return res.status(200).json(spend);

            case 'agent-summaries':
                const agents = await ObservabilityService.getAgentSummaries(tenantId, days);
                return res.status(200).json(agents);

            case 'model-summaries':
                const models = await ObservabilityService.getModelSummaries(tenantId, days);
                return res.status(200).json(models);

            case 'recent':
                const limit = parseInt((req.query.limit as string) || '50', 10);
                const recent = await ObservabilityService.getRecentUsage(limit, tenantId);
                return res.status(200).json(recent);

            case 'job-summary':
                const jobId = req.query.jobId as string;
                if (!jobId) {
                    return res.status(400).json({ error: 'jobId required' });
                }
                const jobSummary = await ObservabilityService.getJobSummary(jobId);
                return res.status(200).json(jobSummary);

            default:
                return res.status(404).json({ error: 'Unknown endpoint' });
        }
    } catch (error: any) {
        console.error('[Observability API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
