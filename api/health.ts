
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(request: VercelRequest, response: VercelResponse) {
    return response.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: {
            hasInngest: !!process.env.INNGEST_EVENT_KEY,
            hasDb: !!process.env.DATABASE_URL
        }
    });
}
