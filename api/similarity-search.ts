import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EmbeddingService } from '../src/services/backend/embedding.js';
import { RateLimiter } from './_lib/rateLimit.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // Rate Limiting
    const ip = (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress || 'unknown';
    if (!RateLimiter.check(ip)) {
        return response.status(429).json({ error: 'Too Many Requests' });
    }

    try {
        const { query, apiKeys, limit, threshold } = request.body;

        if (!query) {
            return response.status(400).json({ error: 'Missing query' });
        }
        if (!apiKeys?.openrouter) {
            // In prod we might use a server-side key, but for now we rely on user key or fallback
            // If no key provided, we can't generate embedding via OpenRouter
            return response.status(400).json({ error: 'Missing OpenRouter API Key for embedding generation' });
        }

        const results = await EmbeddingService.search(
            query,
            apiKeys,
            limit || 3,
            threshold || 0.8
        );

        return response.status(200).json({ success: true, results });

    } catch (error: any) {
        console.error("Similarity Search API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
