
import { inngest } from "../client";
import { OrchestratorAgent } from "../../services/agents/OrchestratorAgent";

export const researchWorkflow = inngest.createFunction(
    {
        id: "research-workflow",
        concurrency: { limit: 5 },
        retries: 3,
        onFailure: async ({ event, error }) => {
            // @ts-ignore - Inngest typing quirk
            const { jobId } = event.data;
            console.error(`[Workflow Failed] Job ${jobId}:`, error);
            const agent = new OrchestratorAgent(jobId);
            await agent.fail(error);
        }
    },
    { event: "app/research.started" },
    async ({ event, step }) => {
        // @ts-ignore - Custom event prop
        const { jobId, inputRaw, mode = 'balanced', forceRefresh, apiKeys, agentConfig } = event.data;
        const agent = new OrchestratorAgent(jobId, apiKeys);

        // 1. Initialize DB Record
        const item = await step.run("create-db-item", async () => {
            return await agent.getOrCreateItem(inputRaw, forceRefresh);
        });

        // 2. Planning
        await step.run("transition-planning", () => agent.transition('planning'));
        const plan = await step.run("generate-plan", async () => {
            const { DiscoveryAgent } = await import("../../services/agents/DiscoveryAgent");
            return await DiscoveryAgent.plan(
                inputRaw,
                mode,
                apiKeys,
                agentConfig?.prompts?.discovery,
                (msg) => agent.log('discovery', msg)
            );
        });

        // 3. Execution (Discovery)
        await step.run("transition-searching", () => agent.transition('searching'));
        const searchResults = await step.run("execute-search", async () => {
            const { DiscoveryAgent } = await import("../../services/agents/DiscoveryAgent");
            const { LogisticsAgent } = await import("../../services/agents/LogisticsAgent");

            // Core Search
            const results = await DiscoveryAgent.execute(
                plan as any,
                mode,
                apiKeys,
                agentConfig?.budgets,
                (msg) => agent.log('discovery', msg)
            );

            // Logistics Check (if needed)
            if (mode !== 'fast' && plan.canonical_name) {
                const logistics = await LogisticsAgent.checkNixRu(
                    plan.canonical_name,
                    apiKeys,
                    (msg) => agent.log('logistics', msg)
                );
                if (logistics.url) {
                    results.push({
                        url: logistics.url,
                        title: "Logistics Data (NIX.ru)",
                        markdown: `Logistics Data:\nWeight: ${logistics.weight}\nDimensions: ${logistics.dimensions}`,
                        source_type: 'nix_ru',
                        timestamp: new Date().toISOString()
                    });
                }
            }

            return results;
        });

        // 4. Extraction
        await step.run("transition-enrichment", () => agent.transition('enrichment'));
        const extractedData = await step.run("extract-data", async () => {
            const { SynthesisAgent } = await import("../../services/agents/SynthesisAgent");
            const combinedSources = searchResults.map((r: any) =>
                `Source: ${r.url} (${r.source_type})\n---\n${r.markdown}`
            );
            return await SynthesisAgent.merge(
                combinedSources,
                "StrictConsumableData",
                apiKeys,
                agentConfig?.prompts?.synthesis,
                (msg) => agent.log('synthesis', msg)
            );
        });

        // 5. Verification
        await step.run("transition-gate-check", () => agent.transition('gate_check'));
        const verification = await step.run("verify-data", async () => {
            const { QualityGatekeeper } = await import("../../services/agents/QualityGatekeeper");
            // @ts-ignore
            return await QualityGatekeeper.validate(extractedData);
        });

        // 6. DB Update & Finalization
        const result = await step.run("finalize-db", async () => {
            return await agent.complete(verification, extractedData);
        });

        return {
            success: true,
            ...result
        };
    }
);
