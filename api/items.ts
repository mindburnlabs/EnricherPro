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
        const items = item ? [item] : [];

        return response.status(200).json({ success: true, items });
    } catch (error) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
