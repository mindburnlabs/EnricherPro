import { VercelRequest, VercelResponse } from '@vercel/node';
import { ItemsRepository } from '../src/repositories/itemsRepository.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const limit = Number(req.query.limit) || 50;
        const jobs = await ItemsRepository.listAll(limit);

        // Calculate basic stats for the dashboard widget
        // In a real app, this should probably be a separate efficient query or cached
        // For now, simple aggregation on the last 50 items
        const stats = {
            tokens: jobs.reduce((acc, job) => acc + 3500, 0), // Mock token count per job for now (avg)
            cost: jobs.reduce((acc, job) => acc + 0.15, 0),   // Mock cost per job
            apiCalls: jobs.reduce((acc, job) => acc + 12, 0)  // Mock calls per job
        };

        return res.status(200).json({ 
            jobs,
            stats
        });
    } catch (error) {
        console.error("Failed to fetch jobs:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
