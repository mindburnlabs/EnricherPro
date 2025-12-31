import { ItemsRepository } from "../../repositories/itemsRepository.js";
import { db } from "../../db.js";
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

    async getOrCreateItem(inputRaw: string, forceRefresh = false): Promise<any> {
        // Initialize DB Record
        const item = await ItemsRepository.createOrGet(this.tenantId, this.jobId, "PENDING-MPN", {
            mpn_identity: { mpn: "PENDING", canonical_model_name: inputRaw },
            brand: null,
            status: "processing",
            processing_step: "planning"
        } as any, forceRefresh);
        this.itemId = item.id;
        return item;
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
