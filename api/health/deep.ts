
import { sql } from 'drizzle-orm';
import { db } from '../../src/db';

export default async function handler(req, res) {
    const health = {
        status: 'healthy',
        checks: {
            database: 'pending',
            firecrawl: 'pending',
            llm: 'pending'
        },
        timestamp: new Date().toISOString()
    };

    // 1. Database Check
    try {
        await db.execute(sql`SELECT 1`);
        health.checks.database = 'connected';
    } catch (e) {
        health.checks.database = 'failed';
        health.status = 'degraded';
        console.error("DB Check Failed:", e);
    }

    // 2. Firecrawl Check (Metadata only to avoid cost)
    if (process.env.FIRECRAWL_API_KEY) {
        health.checks.firecrawl = 'configured';
        // In a real scenario, we might call a lightweight 'account' endpoint if exists
    } else {
        health.checks.firecrawl = 'missing_key';
        health.status = 'degraded';
    }

    // 3. LLM Check
    if (process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY) {
        health.checks.llm = 'configured';
    } else {
        health.checks.llm = 'missing_key';
        health.status = 'degraded';
    }

    // Response
    const code = health.status === 'healthy' ? 200 : 503;
    res.status(code).json(health);
}
