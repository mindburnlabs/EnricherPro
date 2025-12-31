
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { items, jobs } from '../db/schema';
import { Transformers } from '../lib/transformers';
import { ConsumableData } from '../types/domain';

export class ItemsRepository {

    static async createOrGet(jobId: string, mpn: string, initialData: ConsumableData) {
        // 1. Idempotency: Check if item exists for this job
        const existingInJob = await this.findByJobId(jobId);
        if (existingInJob) {
            console.log(`[Idempotency] Item already exists for job ${jobId}`);
            return existingInJob;
        }

        // 2. Global Deduplication (if MPN provided)
        if (mpn) {
            const { DeduplicationService } = await import("../services/backend/DeduplicationService");
            const duplicate = await DeduplicationService.findPotentialDuplicate(mpn);
            if (duplicate) {
                console.log(`[Dedup] Found existing item ${duplicate.id} for MPN ${mpn}`);
                // In a real app we might link this job to the existing item or merge.
                // For this MVP, we will RETURN THE EXISTING ITEM so the frontend sees the "Already Researching/Done" item.
                // However, the Job ID stored on that item will be OLD.
                // This means 'useResearchStream' might poll the OLD item if we just return it?
                // Actually 'check_status' polls by JobID. If we return an item with a DIFFERENT JobID,
                // the frontend might be confused if it filters by current JobID.
                // 
                // Strategy: Update the existing item to point to the NEW JobID? 
                // No, that breaks history.
                //
                // Strategy B: Create a NEW item but copy data?
                //
                // Strategy C: For now, strict existing return.
                return this.findById(duplicate.id);
            }
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

    static async updateStep(id: string, step: string) {
        await db.update(items)
            .set({
                currentStep: step,
                updatedAt: new Date()
            })
            .where(eq(items.id, id));
    }

    static async setStatus(id: string, status: 'processing' | 'needs_review' | 'published' | 'rejected' | 'failed', reason?: string) {
        await db.update(items)
            .set({ status: status, reviewReason: reason, updatedAt: new Date() })
            .where(eq(items.id, id));
    }
}
