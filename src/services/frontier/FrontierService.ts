import { db } from "../../db/index.js";
import { frontier } from "../../db/schema.js";
import { eq, and, desc, asc, ne } from "drizzle-orm";

export type FrontierType = 'query' | 'url' | 'domain_crawl' | 'deep_crawl' | 'crawl_status' | 'firecrawl_agent';

export class FrontierService {

    /**
     * Add a task to the frontier if it hasn't been processed or pending for this job already.
     */
    static async add(jobId: string, type: FrontierType, value: string, priority = 50, depth = 0, meta = {}) {
        // Deduplication Check
        const existing = await db.query.frontier.findFirst({
            where: and(
                eq(frontier.jobId, jobId),
                eq(frontier.value, value),
                eq(frontier.type, type)
            )
        });

        if (existing) {

            return null;
        }

        const [item] = await db.insert(frontier).values({
            jobId,
            type,
            value,
            priority,
            depth,
            status: 'pending',
            meta
        }).returning();

        return item;
    }

    /**
     * Pop the next highest priority item for a job.
     */
    static async next(jobId: string): Promise<typeof frontier.$inferSelect | null> {
        // Simple transaction-like fetch: get, then update status to processing
        // Note: In heavy concurrency, maybe use a transaction.

        const nextItem = await db.query.frontier.findFirst({
            where: and(
                eq(frontier.jobId, jobId),
                eq(frontier.status, 'pending')
            ),
            orderBy: [desc(frontier.priority), asc(frontier.createdAt)],
        });

        if (!nextItem) return null;

        await db.update(frontier)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(frontier.id, nextItem.id));

        return nextItem;
    }

    /**
     * Batch fetch next N priority items.
     */
    static async nextBatch(jobId: string, limit: number): Promise<typeof frontier.$inferSelect[]> {
        const nextItems = await db.query.frontier.findMany({
            where: and(
                eq(frontier.jobId, jobId),
                eq(frontier.status, 'pending')
            ),
            orderBy: [desc(frontier.priority), asc(frontier.createdAt)],
            limit: limit
        });

        if (nextItems.length === 0) return [];

        const ids = nextItems.map(i => i.id);
        const { inArray } = await import("drizzle-orm");

        await db.update(frontier)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(inArray(frontier.id, ids));

        return nextItems;
    }

    /**
     * Mark a frontier item as completed or failed
     */
    static async complete(id: string, status: 'completed' | 'failed') {
        await db.update(frontier)
            .set({ status, updatedAt: new Date() })
            .where(eq(frontier.id, id));
    }

    /**
     * Get stats for job
     */
    static async stats(jobId: string) {
        const items = await db.query.frontier.findMany({
            where: eq(frontier.jobId, jobId)
        });

        return {
            total: items.length,
            pending: items.filter(i => i.status === 'pending').length,
            processing: items.filter(i => i.status === 'processing').length,
            completed: items.filter(i => i.status === 'completed').length,
            failed: items.filter(i => i.status === 'failed').length
        };
    }
}
