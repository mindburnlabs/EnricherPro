
import { inngest } from "../client";
import { ItemsRepository } from "../../repositories/itemsRepository";

export const researchWorkflow = inngest.createFunction(
    {
        id: "research-workflow",
        concurrency: { limit: 5 },
        retries: 3,
        onFailure: async ({ event, error }) => {
            // @ts-ignore - Inngest typing quirk
            const { jobId } = event.data;
            console.error(`[Workflow Failed] Job ${jobId}:`, error);

            // Try to find the item and mark it as failed
            // We can't use step.run here easily as context might be lost or different
            // But we can try direct DB access if possible, or just log for now.
            // Better: Load item by jobId and update status.
            try {
                const item = await ItemsRepository.findByJobId(jobId);
                if (item) {
                    await ItemsRepository.setStatus(item.id, 'failed', error.message);
                }
            } catch (e) {
                console.error("Failed to update status on failure", e);
            }
        }
    },
    { event: "app/research.started" },
    async ({ event, step }) => {
        const { jobId, inputRaw } = event.data;

        // 1. Initialize DB Record (Idempotent)
        const item = await step.run("create-db-item", async () => {
            return await ItemsRepository.createOrGet(jobId, "PENDING-MPN", {
                // @ts-ignore - Minimal skeleton
                mpn_identity: { mpn: "PENDING", canonical_model_name: inputRaw },
                brand: null,
                status: "processing"
            } as any);
        });

        // 2. Planning
        const plan = await step.run("generate-plan", async () => {
            // Import dynamically to avoid side-effects in top-level
            const { plannerStep } = await import("../steps/planner");
            return await plannerStep(inputRaw);
        });

        // 3. Execution (Real Firecrawl Search)
        const searchResults = await step.run("execute-search", async () => {
            const { BackendFirecrawlService } = await import("../../services/backend/firecrawl");

            const queries = plan.searchQueries || [`${inputRaw} specs`];
            const allResults = [];

            for (const q of queries) {
                // Limited search for MVP
                const res = await BackendFirecrawlService.search(q, { limit: 2 });
                allResults.push(...res);
            }
            return allResults;
        });

        // 4. Extraction
        const extractedData = await step.run("extract-data", async () => {
            const { extractorStep } = await import("../steps/extractor");
            // Concat text from top 3 results
            const combinedText = searchResults.slice(0, 3).map((r: any) => r.markdown || "").join("\n\n");
            return await extractorStep(combinedText, "ConsumableData");
        });

        // 5. Verification
        const verification = await step.run("verify-data", async () => {
            const { verifierStep } = await import("../steps/verifier");
            // @ts-ignore
            return await verifierStep(extractedData);
        });

        // 6. DB Update
        await step.run("finalize-db", async () => {
            // Save final data to DB
            // @ts-ignore
            await ItemsRepository.updateData(item.id, extractedData);

            const status = verification.isValid ? 'published' : 'needs_review';
            await ItemsRepository.setStatus(item.id, status, verification.errors.join(", "));
        });

        return {
            success: true,
            itemId: item.id,
            status: verification.isValid ? 'published' : 'needs_review'
        };
    }
);
