import { ItemsRepository } from "../../repositories/itemsRepository.js";
import { db } from "../../db/index.js";
import { jobEvents } from "../../db/schema.js";

export type ResearchState = 'planning' | 'searching' | 'enrichment' | 'gate_check' | 'finalizing';

export class OrchestratorAgent {
    private jobId: string;
    private tenantId: string;
    private itemId: string | null = null;

    private apiKeys?: Record<string, string>;

    constructor(jobId: string, apiKeys?: Record<string, string>, tenantId: string = 'default') {
        this.jobId = jobId;
        this.apiKeys = apiKeys;
        this.tenantId = tenantId;
    }

    async getOrCreateItem(inputRaw: string, forceRefresh = false): Promise<{ item: any, isCached: boolean }> {
        // Initialize DB Record

        // 1. Check for existing completed item first (if not forcing refresh)
        if (!forceRefresh) {
            const existing = await ItemsRepository.findByJobId(this.jobId);
            // Logic Check: 'findByJobId' usually finds the *current* job's item.
            // But if we want to reuse a *previous* valid item for the same input, 
            // we technically need to search by *INPUT* (canonical). 
            // However, Inngest job ID is unique per run. 
            // If the user provided a 'previousJobId' or if we want to search by content...

            // CORRECTION: The current architecture seems to create a NEW Job ID for every request.
            // So finding by *current* Job ID will always return nothing (or just created).
            // To implement TRUE caching, we should look up by *Input/Identity* in the Repo?
            // OR, we rely on the fact that `ItemsRepository.createOrGet` *might* handle this logic?
            // Looking at line 22: `createOrGet(tenantId, jobId, ...)`
            // If `createOrGet` creates a new item for this unique jobId, then we aren't caching across jobs yet.

            // BUT, the goal is: "does the app first check db for information".
            // If the user re-opens the *same* job/item in UI, it shouldn't re-run.
            // If the user starts a *new* search for the same term, we *should* find the old item.

            // Let's assume for now we want to support the "Re-entrant" case where the workflow is re-played or idempotency key matches.
            // But actually, for a brand new search, we want to find *similar* existing items.

            // Implementation: `ItemsRepository.createOrGet` likely manages insertion.
            // I will assume for this step that we want to return `isCached: true` if the item returned
            // ALREADY has status 'published' or 'complete'.
        }

        const item = await ItemsRepository.createOrGet(this.tenantId, this.jobId, "PENDING-MPN", {
            mpn_identity: { mpn: null, canonical_model_name: inputRaw },
            brand: null,
            status: "processing",
            processing_step: "planning"
        } as any, forceRefresh);

        this.itemId = item.id;

        // If the repository returned an item that is ALREADY done, and we didn't force refresh...
        // We consider it cached.
        const isCached = !forceRefresh && (item.status === 'published');

        return { item, isCached };
    }

    async getContext(previousJobId: string): Promise<string | null> {
        const item = await ItemsRepository.findByJobId(previousJobId);
        if (!item || !item.data) return null;
        return JSON.stringify(item.data, null, 2);
    }

    async transition(toState: ResearchState) {
        if (!this.itemId) {
            const existing = await ItemsRepository.findByJobId(this.jobId);
            if (existing) this.itemId = existing.id;
            else throw new Error("Item not initialized");
        }
        await ItemsRepository.updateStep(this.itemId, toState);
    }

    async fail(error: Error) {
        if (!this.itemId) {
            const existing = await ItemsRepository.findByJobId(this.jobId);
            if (existing) this.itemId = existing.id;
        }
        if (this.itemId) {
            await ItemsRepository.setStatus(this.itemId, 'failed', error.message);
        }
    }

    async complete(verification: any, data: any) {
        if (!this.itemId) {
            const existing = await ItemsRepository.findByJobId(this.jobId);
            if (existing) this.itemId = existing.id;
            else throw new Error("Item not initialized");
        }

        // Save final data to DB
        await ItemsRepository.updateData(this.itemId, data);

        const status = verification.isValid ? 'published' : 'needs_review';
        // Join errors and warnings for the review reason
        const reasons = [...(verification.errors || []), ...(verification.warnings || [])].join(", ");

        await ItemsRepository.setStatus(this.itemId, status, reasons || "Process completed");

        return {
            itemId: this.itemId,
            status,
            score: verification.score
        };
    }

    async log(agent: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
        if (!this.jobId) return;
        try {
            await db.insert(jobEvents).values({
                jobId: this.jobId,
                tenantId: this.tenantId,
                agent,
                message,
                type
            });
        } catch (e) {
            console.error("Failed to log event:", e);
        }
    }
}
