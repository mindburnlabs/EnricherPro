
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let pool: any = null;

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { jobId } = request.query;

    if (!jobId || Array.isArray(jobId)) {
        return response.status(400).json({ error: 'Missing or invalid jobId' });
    }

    // Initialize pool if needed
    if (!pool) {
        const pg = require('pg');
        const { Pool } = pg;
        if (!process.env.DATABASE_URL) {
            console.error("DATABASE_URL missing");
            return response.status(500).json({ error: 'Server Configuration Error' });
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 1, // Serverless: limit connections
        });
    }

    // Set headers for SSE
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    response.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

    const pollInterval = 2000; // Poll every 2 seconds
    let lastStep = '';
    let lastStatus = '';
    let lastUpdatedAt = 0;
    let lastLogTimestamp = new Date(0);

    const intervalId = setInterval(async () => {
        try {
            // Query Items
            const itemsResult = await pool.query(
                `SELECT * FROM items WHERE job_id = $1 LIMIT 1`,
                [jobId]
            );
            const item = itemsResult.rows[0];

            if (item) {
                const currentUpdatedAt = item.updated_at ? new Date(item.updated_at).getTime() : 0;

                // 1. Fetch new logs separately (Incremental)
                const logsResult = await pool.query(
                    `SELECT * FROM job_events WHERE job_id = $1 AND timestamp > $2 ORDER BY timestamp ASC`,
                    [jobId, lastLogTimestamp.toISOString()]
                );
                const logs = logsResult.rows.map((row: any) => ({
                    // Map snake_case to camelCase if needed, though simple fields usually match or are handled
                    id: row.id,
                    jobId: row.job_id,
                    tenantId: row.tenant_id,
                    agent: row.agent,
                    message: row.message,
                    type: row.type,
                    timestamp: row.timestamp
                }));

                if (logs.length > 0) {
                    // Update cursor to the newest log's timestamp
                    const newestLog = logs[logs.length - 1];
                    if (newestLog && newestLog.timestamp) {
                        lastLogTimestamp = new Date(newestLog.timestamp);
                    }
                    response.write(`data: ${JSON.stringify({ type: 'logs', logs })}\n\n`);
                }

                // 2. Check Item Status
                // item columns are snake_case from pg: current_step, status, updated_at
                const currentStep = item.current_step || '';
                const status = item.status || '';

                if (currentStep !== lastStep || status !== lastStatus || currentUpdatedAt > lastUpdatedAt) {

                    const payload = {
                        type: 'update',
                        step: currentStep,
                        status: status,
                        data: item.data,
                        reviewReason: item.review_reason
                    };

                    response.write(`data: ${JSON.stringify(payload)}\n\n`);

                    lastStep = currentStep;
                    lastStatus = status;
                    lastUpdatedAt = currentUpdatedAt;

                    // If final status, close connection
                    if (['published', 'needs_review', 'failed'].includes(status)) {
                        response.write(`data: ${JSON.stringify({ type: 'complete', status: status })}\n\n`);
                        clearInterval(intervalId);
                        response.end();
                    }
                }
            } else {
                // Item not found yet
            }
        } catch (error) {
            console.error("SSE Poll Error:", error);
            response.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal polling error: ' + String(error) })}\n\n`);
            clearInterval(intervalId);
            response.end();
        }
    }, pollInterval);

    // Clean up on client disconnect
    request.on('close', () => {
        clearInterval(intervalId);
        response.end();
    });
}
