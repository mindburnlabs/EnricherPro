
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { items, jobs } from '../db/schema';
import { Transformers } from '../lib/transformers';
import { ConsumableData } from '../types/domain';

export class ItemsRepository {

    static async createOrGet(tenantId: string, jobId: string, mpn: string, initialData: ConsumableData, forceRefresh = false) {
        // 1. Idempotency: Check if item exists for this job
        const existingInJob = await this.findByJobId(jobId);
        if (existingInJob) {
            return existingInJob;
        }

        // 2. Global Deduplication (if MPN provided)
        if (mpn) {
            const { DeduplicationService } = await import("../services/backend/DeduplicationService");
            const duplicate = await DeduplicationService.findPotentialDuplicate(mpn);
            if (duplicate) {
                if (forceRefresh) {
                    // FORCE REFRESH: Hijack the existing item for this new job
                    const [updated] = await db.update(items)
                        .set({
                            jobId: jobId, // Point to new job
                            status: 'processing', // Reset status
                            currentStep: 'planning', // Reset step
                            updatedAt: new Date(),
                            reviewReason: null // Clear errors
                        })
                        .where(eq(items.id, duplicate.id))
                        .returning();
                    return updated;
                }

                // Standard Dedup: Return existing item (and let frontend see old job status potentially)
                return this.findById(duplicate.id);
            }
        }

        const [newItem] = await db.insert(items).values({
            tenantId,
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
