
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemsRepository } from '../src/repositories/itemsRepository';
import { v4 as uuidv4 } from 'uuid';

// Mock the external services if we were testing them, 
// but here we want to verify the Repository <-> Data flow which is the core of "Reliability"
// We will simulate the Workflow's actions on the DB.

import { db } from '../src/db';
import { jobs } from '../src/db/schema';

describe('End-to-End Workflow Simulation', () => {
    const jobId = uuidv4();
    const mpn = "TEST-E2E-123";

    beforeEach(async () => {
        // Create parent job to satisfy FK
        await db.insert(jobs).values({
            id: jobId,
            inputRaw: "TEST QUERY"
        }).onConflictDoNothing();
    });

    it('should handle the full lifecycle of an item', async () => {
        // 1. Workflow Start: Create Item (Idempotent check)
        console.log("Step 1: Creating Item");
        const item = await ItemsRepository.createOrGet(jobId, mpn, {
            mpn_identity: { mpn, canonical_model_name: "Test Model" },
            brand: "Test Brand",
            status: "processing"
        } as any);

        expect(item).toBeDefined();
        expect(item.status).toBe('processing');
        expect(item.jobId).toBe(jobId);

        // 2. Simulate Idempotency (Retry)
        console.log("Step 2: Simulating Retry");
        const itemRetry = await ItemsRepository.createOrGet(jobId, mpn, {
            mpn_identity: { mpn, canonical_model_name: "Test Model" },
            brand: "Test Brand",
            status: "processing"
        } as any);

        expect(itemRetry.id).toBe(item.id); // Should be same item
        expect(itemRetry.createdAt).toEqual(item.createdAt);

        // 3. Simulate Data Enrichment (Update Data)
        console.log("Step 3: Enriching Data");
        const enrichedData = {
            ...(item.data as any),
            specs: { color: "Black", yield: "1000" },
            marketing: { description: "Best toner ever" }
        };
        await ItemsRepository.updateData(item.id, enrichedData as any);

        const updatedItem = await ItemsRepository.findByJobId(jobId);
        expect((updatedItem?.data as any).specs).toEqual({ color: "Black", yield: "1000" });

        // 4. Simulate Completion (Set Status)
        console.log("Step 4: Completing Workflow");
        await ItemsRepository.setStatus(item.id, 'needs_review', 'Low confidence on yield');

        const finalItem = await ItemsRepository.findByJobId(jobId);
        expect(finalItem?.status).toBe('needs_review');
        expect(finalItem?.reviewReason).toBe('Low confidence on yield');
    });
});
