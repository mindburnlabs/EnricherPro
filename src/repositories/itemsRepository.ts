
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { items, jobs } from '../db/schema';
import { Transformers } from '../lib/transformers';
import { ConsumableData } from '../types/domain';

export class ItemsRepository {

    static async createOrGet(jobId: string, mpn: string, initialData: ConsumableData) {
        // Idempotency: Check if item exists for this job
        const existing = await this.findByJobId(jobId);
        if (existing) {
            console.log(`[Idempotency] Item already exists for job ${jobId}`);
            return existing;
        }

        const [newItem] = await db.insert(items).values({
            jobId,
            mpn,
            brand: initialData.brand,
            model: initialData.model,
            data: Transformers.toDbData(initialData),
            status: 'processing'
        }).returning();

        return newItem;
    }

    static async findById(id: string) {
        const [item] = await db.select().from(items).where(eq(items.id, id));
        if (!item) return null;
        return item;
    }

    static async findByJobId(jobId: string) {
        const [item] = await db.select().from(items).where(eq(items.jobId, jobId));
        if (!item) return null;
        return item;
    }

    static async getDomainItem(id: string): Promise<ConsumableData | null> {
        const item = await this.findById(id);
        if (!item) return null;
        return Transformers.toDomain(item);
    }

    static async updateData(id: string, partialData: Partial<ConsumableData>) {
        // Need to fetch first to merge JSON (in a real app, use jsonb_set or deep merge)
        // For MVP we do Read-Modify-Write
        const current = await this.getDomainItem(id);
        if (!current) throw new Error(`Item ${id} not found`);

        const newData = { ...current, ...partialData };

        const [updated] = await db.update(items)
            .set({
                data: Transformers.toDbData(newData),
                updatedAt: new Date()
            })
            .where(eq(items.id, id))
            .returning();

        return updated;
    }

    static async setStatus(id: string, status: 'processing' | 'needs_review' | 'published' | 'rejected' | 'failed', reason?: string) {
        // @ts-ignore - DB schema string enum might need update or cast
        await db.update(items)
            .set({ status: status as any, reviewReason: reason, updatedAt: new Date() })
            .where(eq(items.id, id));
    }
}
