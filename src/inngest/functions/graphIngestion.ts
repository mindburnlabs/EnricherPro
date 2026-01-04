/**
 * Scheduled Graph Ingestion - Inngest Function
 *
 * Runs on a schedule to batch-process recently completed research items
 * and populate the Graph-Lite knowledge base with entities, edges, and evidence.
 *
 * SOTA v4.3: Enables "Fast Path" resolution for future research on known items.
 */

import { inngest } from '../client.js';
import { db } from '../../db/index.js';
import { items, jobs } from '../../db/schema.js';
import { eq, and, isNull, gte, desc, sql } from 'drizzle-orm';
import { GraphPopulator } from '../../services/ingestion/GraphPopulator.js';

// Configuration
const BATCH_SIZE = 10; // Items per run
const LOOKBACK_HOURS = 24; // Only process items from last 24h

/**
 * SCHEDULED: Runs every 6 hours to populate graph from new research
 */
export const graphIngestionScheduled = inngest.createFunction(
  {
    id: 'graph-ingestion-scheduled',
    concurrency: { limit: 1 }, // Single instance
    retries: 2,
  },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ step }) => {
    console.log('[GraphIngestion] Starting scheduled batch...');

    // 1. Find completed items that haven't been ingested yet
    const candidateItems = await step.run('find-candidates', async () => {
      const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

      return db
        .select({
          id: items.id,
          jobId: items.jobId,
          data: items.data,
          status: items.status,
        })
        .from(items)
        .innerJoin(jobs, eq(items.jobId, jobs.id))
        .where(
          and(
            eq(items.status, 'published'),
            eq(jobs.status, 'completed'),
            gte(items.updatedAt, since),
            // Check if not already in graph (via metadata flag)
            sql`NOT (${items.data}::jsonb ? '_graphIngested')`,
          ),
        )
        .orderBy(desc(items.updatedAt))
        .limit(BATCH_SIZE);
    });

    console.log(`[GraphIngestion] Found ${candidateItems.length} candidates for ingestion`);

    if (candidateItems.length === 0) {
      return { processed: 0, errors: 0 };
    }

    // 2. Process each item through GraphPopulator
    const results = await step.run('process-batch', async () => {
      let processed = 0;
      let errors = 0;

      for (const item of candidateItems) {
        try {
          if (!item.data) continue;

          const result = await GraphPopulator.populateFromResearch(
            item.id,
            item.data as any,
            item.jobId,
          );

          console.log(
            `[GraphIngestion] Item ${item.id}: ${result.entitiesCreated} entities, ${result.edgesCreated} edges`,
          );

          // Mark as ingested by adding flag to data
          await db
            .update(items)
            .set({
              data: sql`${items.data}::jsonb || '{"_graphIngested": true}'::jsonb`,
              updatedAt: new Date(),
            })
            .where(eq(items.id, item.id));

          processed++;
        } catch (error) {
          console.error(`[GraphIngestion] Error processing item ${item.id}:`, error);
          errors++;
        }
      }

      return { processed, errors };
    });

    console.log(
      `[GraphIngestion] Batch complete: ${results.processed} processed, ${results.errors} errors`,
    );

    return results;
  },
);

/**
 * ON-DEMAND: Triggered when a research job completes
 * Allows immediate graph population without waiting for scheduled run
 */
export const graphIngestionOnComplete = inngest.createFunction(
  {
    id: 'graph-ingestion-on-complete',
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: 'app/research.completed' },
  async ({ event, step }) => {
    // Cast event data to access all properties
    const eventData = event.data as { jobId: string; result?: any; itemId?: string };
    const { jobId } = eventData;

    console.log(`[GraphIngestion] Processing on-complete for job ${jobId}`);

    const result = await step.run('populate-graph', async () => {
      // Find items associated with this job
      const jobItems = await db.select().from(items).where(eq(items.jobId, jobId)).limit(5);

      if (jobItems.length === 0) {
        return { skipped: true, reason: 'No items found for job' };
      }

      let processed = 0;
      let entitiesTotal = 0;
      let edgesTotal = 0;

      for (const item of jobItems) {
        if (!item.data) continue;

        // Check if already ingested
        if ((item.data as any)?._graphIngested) {
          continue;
        }

        try {
          // Run population
          const popResult = await GraphPopulator.populateFromResearch(
            item.id,
            item.data as any,
            jobId,
          );

          // Mark as ingested
          await db
            .update(items)
            .set({
              data: sql`${items.data}::jsonb || '{"_graphIngested": true}'::jsonb`,
              updatedAt: new Date(),
            })
            .where(eq(items.id, item.id));

          processed++;
          entitiesTotal += popResult.entitiesCreated;
          edgesTotal += popResult.edgesCreated;
        } catch (error) {
          console.error(`[GraphIngestion] Error for item ${item.id}:`, error);
        }
      }

      return {
        success: true,
        processed,
        entitiesCreated: entitiesTotal,
        edgesCreated: edgesTotal,
      };
    });

    return result;
  },
);
