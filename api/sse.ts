import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { jobs, items, jobEvents, skus } from '../src/db/schema.js';
import { eq, gt, and, desc } from 'drizzle-orm';

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
  // Allow CORS for local dev if needed, though usually handled by proxy
  response.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  response.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

  const pollInterval = 1000; // Poll every 1 second
  let lastStep = '';
  let lastStatus = '';
  let lastUpdatedAt = 0;
  // Track last log timestamp to only fetch new ones.
  // Initialize to epoch 0 to fetch all logs on first connect (or recent ones)
  // For now, let's start from "now" minus a buffer if we want history,
  // or just 0 to get full history for the session.
  let lastLogTimestamp = new Date(0);

  const intervalId = setInterval(async () => {
    try {
      // 1. Fetch Job & Item Status
      // We join items to get the current step/status
      const jobData = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
        with: {
          // We can also fetch the linked item directly here if relations are set up,
          // but let's query broadly to be safe.
          items: {
            limit: 1,
          },
        },
      });

      if (!jobData) {
        // Job might not be created yet if race condition, or invalid
        // We'll just wait.
        return;
      }

      const item = jobData.items[0];

      // 2. Fetch New Logs
      // We use 'jobEvents' table
      const newLogs = await db.query.jobEvents.findMany({
        where: and(eq(jobEvents.jobId, jobId), gt(jobEvents.timestamp, lastLogTimestamp)),
        orderBy: [desc(jobEvents.timestamp)], // We'll reverse them or trusted sort
      });

      if (newLogs.length > 0) {
        // Drizzle returns dates as Date objects usually
        // Update cursor to the newest log
        // Sort by timestamp asc for the client
        newLogs.sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());

        lastLogTimestamp = newLogs[newLogs.length - 1].timestamp;

        const logPayload = newLogs.map((l) => ({
          id: l.id,
          jobId: l.jobId,
          type: l.type,
          agent: l.agent,
          message: l.message,
          timestamp: l.timestamp.toISOString(),
        }));

        response.write(`data: ${JSON.stringify({ type: 'logs', logs: logPayload })}\n\n`);
      }

      // 3. Check for Status Updates (Job or Item)
      const currentStep = item?.currentStep || '';
      const currentStatus = jobData.status || 'pending';
      const itemUpdatedAt = item?.updatedAt ? item.updatedAt.getTime() : 0;
      const jobProgress = jobData.progress || 0;

      if (
        currentStep !== lastStep ||
        currentStatus !== lastStatus ||
        itemUpdatedAt > lastUpdatedAt
      ) {
        const payload = {
          type: 'update',
          step: currentStep,
          status: currentStatus,
          progress: jobProgress,
          reviewReason: item?.reviewReason,
        };

        response.write(`data: ${JSON.stringify(payload)}\n\n`);

        lastStep = currentStep;
        lastStatus = currentStatus;
        lastUpdatedAt = itemUpdatedAt;
      }

      // 4. Check for SKU Data Updates (The "Real-Time Product Card")
      // Only if we have a linked SKU (from the new schema logic)
      // The job schema has `skuId`.
      if (jobData.skuId) {
        const skuData = await db.query.skus.findFirst({
          where: eq(skus.id, jobData.skuId),
          with: {
            claims: true,
          },
        });

        if (skuData) {
          // Normalize for frontend "View Model"
          // We send the whole object or partials.
          // sending whole object is safer for consistency for now.
          response.write(
            `data: ${JSON.stringify({
              type: 'data_update',
              data: {
                id: skuData.id,
                mpn: skuData.mpn,
                brand: skuData.brand,
                title: skuData.supplierString,
                yield: skuData.yieldPages, // direct field
                specs: {
                  color: skuData.color,
                  packageWeight: skuData.packageWeightG,
                  packageDimensions: [
                    skuData.packageLengthMm,
                    skuData.packageWidthMm,
                    skuData.packageHeightMm,
                  ]
                    .filter(Boolean)
                    .join('x'),
                },
                claims: skuData.claims, // Full claims for evidence drawer
              },
            })}\n\n`,
          );
        }
      }

      // 5. Completion Check
      if (['completed', 'failed'].includes(currentStatus)) {
        response.write(`data: ${JSON.stringify({ type: 'complete', status: currentStatus })}\n\n`);
        clearInterval(intervalId);
        response.end();
      }
    } catch (error) {
      console.error('SSE Poll Error:', error);
      // Don't close stream on transient error
    }
  }, pollInterval);

  // Clean up
  request.on('close', () => {
    clearInterval(intervalId);
    response.end();
  });
}
