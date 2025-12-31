
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';
import { items, jobEvents } from '../src/db/schema';
import { eq, gt, and } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { jobId } = request.query;

    if (!jobId || Array.isArray(jobId)) {
        return response.status(400).json({ error: 'Missing or invalid jobId' });
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
    // Track last log timestamp to ONLY fetch new logs (Bandwidth Optimization)
    // Start from 0 to get initial history, then update.
    let lastLogTimestamp = new Date(0);

    const intervalId = setInterval(async () => {
        try {
            const [item] = await db.select().from(items).where(eq(items.jobId, jobId as string));

            if (item) {
                const currentUpdatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

                // 1. Fetch new logs separately (Incremental)
                // Use gt(timestamp, lastLogTimestamp) to avoid re-sending history

                const logs = await db.select().from(jobEvents)
                    .where(
                        and(
                            eq(jobEvents.jobId, jobId as string),
                            gt(jobEvents.timestamp, lastLogTimestamp)
                        )
                    )
                    .orderBy(jobEvents.timestamp);

                if (logs.length > 0) {
                    // Update cursor to the newest log's timestamp
                    const newestLog = logs[logs.length - 1];
                    if (newestLog && newestLog.timestamp) {
                        lastLogTimestamp = new Date(newestLog.timestamp);
                    }
                    response.write(`data: ${JSON.stringify({ type: 'logs', logs })}\n\n`);
                }

                // 2. Check Item Status
                if (item.currentStep !== lastStep || item.status !== lastStatus || currentUpdatedAt > lastUpdatedAt) {

                    const payload = {
                        type: 'update',
                        step: item.currentStep,
                        status: item.status,
                        data: item.data, // Send partial data if needed
                        reviewReason: item.reviewReason
                    };

                    response.write(`data: ${JSON.stringify(payload)}\n\n`);

                    lastStep = item.currentStep || '';
                    lastStatus = item.status || '';
                    lastUpdatedAt = currentUpdatedAt;

                    // If final status, close connection
                    if (['published', 'needs_review', 'failed'].includes(item.status || '')) {
                        // Wait a tick to ensure logs flush? No, synchronous.
                        response.write(`data: ${JSON.stringify({ type: 'complete', status: item.status })}\n\n`);
                        clearInterval(intervalId);
                        response.end();
                    }
                }
            } else {
                // Item not found yet, maybe creating...
            }
        } catch (error) {
            console.error("SSE Poll Error:", error);
            response.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal polling error' })}\n\n`);
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
