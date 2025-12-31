import { ItemsRepository } from "../../repositories/itemsRepository";

export type ResearchState = 'planning' | 'searching' | 'enrichment' | 'gate_check' | 'finalizing';

export class OrchestratorAgent {
    private jobId: string;
    private itemId: string | null = null;

    private apiKeys?: Record<string, string>;

    constructor(jobId: string, apiKeys?: Record<string, string>) {
        this.jobId = jobId;
        this.apiKeys = apiKeys;
    }

    async getOrCreateItem(inputRaw: string, forceRefresh = false): Promise<any> {
        // Initialize DB Record
        const item = await ItemsRepository.createOrGet(this.jobId, "PENDING-MPN", {
            mpn_identity: { mpn: "PENDING", canonical_model_name: inputRaw },
            brand: null,
            status: "processing",
            processing_step: "planning"
        } as any, forceRefresh);
        this.itemId = item.id;
        return item;
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
        }
    }
}
