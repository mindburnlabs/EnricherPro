import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getItemByJobId } from './_lib/db';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const jobId = request.query.jobId as string;

        if (!jobId) {
            return response.status(400).json({ error: 'Missing jobId' });
        }

        const item = await getItemByJobId(jobId);

        if (!item) {
            return response.status(200).json({ status: "pending", steps: [] });
        }

        // Map DB status to UI steps
        const steps = [];

        if (item.status === 'processing') {
            steps.push({ id: 'research', label: 'status.searching', status: 'running' });
        } else if (item.status === 'needs_review') {
            steps.push({ id: 'research_done', label: 'status.complete', status: 'completed' });
            steps.push({ id: 'review', label: 'status.review_required', status: 'running', message: item.review_reason });
        } else if (item.status === 'published') {
            steps.push({ id: 'research_done', label: 'status.complete', status: 'completed' });
            steps.push({ id: 'published', label: 'status.published', status: 'completed' });
        }

        return response.status(200).json({
            status: item.status,
            steps,
            result: item.data
        });
    } catch (error) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
