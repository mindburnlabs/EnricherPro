
import { inngest } from "../client.js";
import { OrchestratorAgent } from "../../services/agents/OrchestratorAgent.js";

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
        const { jobId, tenantId, inputRaw, mode = 'balanced', forceRefresh, apiKeys, agentConfig, sourceConfig, budgets, previousJobId, language = 'en' } = event.data;
        const agent = new OrchestratorAgent(jobId, apiKeys, tenantId);

        // 1. Initialize DB Record
        const item = await step.run("create-db-item", async () => {
            return await agent.getOrCreateItem(inputRaw, forceRefresh);
        });

        // REFINEMENT CONTEXT
        let context = undefined;
        if (previousJobId) {
            context = await step.run("fetch-context", async () => {
                return await agent.getContext(previousJobId) || undefined;
            });
        }

        // 2. Planning
        await step.run("transition-planning", () => agent.transition('planning'));
        const plan = await step.run("generate-plan", async () => {
            const { DiscoveryAgent } = await import("../../services/agents/DiscoveryAgent.js");
            return await DiscoveryAgent.plan(
                inputRaw,
                mode,
                apiKeys,
                agentConfig?.prompts?.discovery,
                (msg) => agent.log('discovery', msg),
                context, // Pass context
                language // Pass language
            );
        });

        // 3. Execution (Frontier Loop)
        await step.run("transition-searching", () => agent.transition('searching'));
        const searchResults = await step.run("execute-frontier", async () => {
            const { FrontierService } = await import("../../services/frontier/FrontierService.js");
            const { BackendFirecrawlService } = await import("../../services/backend/firecrawl.js");
            const { FallbackSearchService } = await import("../../services/backend/fallback.js");
            const { LogisticsAgent } = await import("../../services/agents/LogisticsAgent.js");

            // Dynamic imports for Evidence Layer
            const { SourceDocumentRepository } = await import("../../repositories/SourceDocumentRepository.js");
            const { ClaimsRepository } = await import("../../repositories/ClaimsRepository.js");
            const { SynthesisAgent } = await import("../../services/agents/SynthesisAgent.js");
            const { DiscoveryAgent } = await import("../../services/agents/DiscoveryAgent.js");


            // Seed Frontier with Plan
            if (plan.strategies) {
                for (const strategy of plan.strategies) {
                    for (const query of strategy.queries) {
                        await FrontierService.add(jobId, 'query', query, 50, 0, { strategy: strategy.name, target_domain: strategy.target_domain });
                    }
                }
            }

            // Loop Config
            const MAX_STEPS = mode === 'deep' ? 20 : (mode === 'balanced' ? 10 : 5);
            const allResults: any[] = [];
            let stepsCount = 0;

            while (stepsCount < MAX_STEPS) {
                const task = await FrontierService.next(jobId);
                if (!task) break; // processed everything

                stepsCount++;
                agent.log('discovery', `prowling frontier: ${task.value} (${task.type})`);

                try {
                    let results: any[] = [];
                    // Handle Task Type
                    if (task.type === 'query') {
                        try {
                            const raw = await BackendFirecrawlService.search(task.value, { apiKey: apiKeys?.firecrawl, limit: 3 });
                            results = raw.map(r => ({ ...r, source_type: 'web' }));
                        } catch (e) {
                            console.warn("Firecrawl failed, trying fallback", e);
                            const raw = await FallbackSearchService.search(task.value, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback' }));
                        }
                    } else if (task.type === 'url') {
                        // Placeholder for URL scrape
                    }

                    // Process Results & Evidence Persistence
                    for (const r of results) {
                        allResults.push({
                            url: r.url,
                            title: r.title,
                            markdown: r.markdown,
                            source_type: r.source_type,
                            timestamp: new Date().toISOString()
                        });

                        // 1. Save Raw Source Document
                        let sourceDocId;
                        try {
                            const sourceDoc = await SourceDocumentRepository.create({
                                jobId,
                                url: r.url,
                                domain: new URL(r.url).hostname,
                                rawContent: r.markdown,
                                status: 'success',
                                extractedMetadata: { title: r.title, type: r.source_type }
                            });
                            sourceDocId = sourceDoc.id;

                            // 2. Extract Claims (Evidence-First)
                            const claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys);

                            // 3. Persist Claims
                            if (claims && claims.length > 0) {
                                await ClaimsRepository.createBatch(claims.map(c => ({
                                    itemId: item.id,
                                    sourceDocId: sourceDoc.id,
                                    field: c.field,
                                    value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
                                    confidence: Math.round(c.confidence * 100)
                                })));
                                agent.log('synthesis', `Extracted ${claims.length} claims from ${r.url}`);
                            }
                        } catch (err) {
                            console.warn(`Failed to process evidence for ${r.url}`, err);
                        }
                    }

                    // 4. Frontier Expansion (Phase A)
                    if (mode !== 'fast' && stepsCount < MAX_STEPS && results.length > 0) {
                        try {
                            const newQueries = await DiscoveryAgent.analyzeForExpansion(task.value, results.map(r => ({
                                url: r.url,
                                title: r.title,
                                markdown: r.markdown || "",
                                source_type: r.source_type as any,
                                timestamp: new Date().toISOString()
                            })), apiKeys);

                            if (newQueries && newQueries.length > 0) {
                                for (const q of newQueries) {
                                    await FrontierService.add(jobId, 'query', q, 40, (task.depth || 0) + 1, { discovered_from: task.value });
                                }
                            }
                        } catch (err) {
                            console.warn("Expansion failed", err);
                        }
                    }

                    await FrontierService.complete(task.id, 'completed');
                } catch (e) {
                    console.error("Frontier task failed", e);
                    await FrontierService.complete(task.id, 'failed');
                }
            }

            // Logistics Check (Side-quest)
            if (mode !== 'fast' && plan.canonical_name) {
                const logistics = await LogisticsAgent.checkNixRu(
                    plan.canonical_name,
                    apiKeys,
                    (msg) => agent.log('logistics', msg)
                );
                if (logistics.url) {
                    allResults.push({
                        url: logistics.url,
                        title: "Logistics Data (NIX.ru)",
                        markdown: `Logistics Data:\nWeight: ${logistics.weight}\nDimensions: ${logistics.dimensions}`,
                        source_type: 'nix_ru',
                        timestamp: new Date().toISOString()
                    });
                }
            }

            return allResults;
        });

        // 4. Truth Resolution (Phase G)
        await step.run("transition-enrichment", () => agent.transition('enrichment'));
        const extractedData = await step.run("resolve-truth", async () => {
            const { ClaimsRepository } = await import("../../repositories/ClaimsRepository.js");
            const { TrustEngine } = await import("../../services/engine/TrustEngine.js");
            const { SynthesisAgent } = await import("../../services/agents/SynthesisAgent.js");

            // 1. Fetch all claims
            const allClaims = await ClaimsRepository.findByItemId(item.id);

            // 2. Group by field
            const claimsByField: Record<string, any[]> = {};
            for (const claim of allClaims) {
                if (!claimsByField[claim.field]) claimsByField[claim.field] = [];
                claimsByField[claim.field].push(claim);
            }

            // 3. Resolve each field
            const resolvedData: any = { _evidence: {} };

            for (const field of Object.keys(claimsByField)) {
                const best = TrustEngine.resolveField(claimsByField[field]);
                if (best) {
                    // Unflatten the field (simple dot notation support)
                    const parts = field.split('.');
                    let curr = resolvedData;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!curr[parts[i]]) curr[parts[i]] = {};
                        curr = curr[parts[i]];
                    }

                    // Parse value if JSON
                    let val = best.value;
                    try { val = JSON.parse(best.value as any); } catch (e) { }
                    curr[parts[parts.length - 1]] = val;

                    // Metadata / Evidence
                    resolvedData._evidence[field] = {
                        value: val,
                        confidence: best.confidence,
                        source_url: best.sources[0], // Primary source
                        timestamp: new Date().toISOString(),
                        is_conflict: best.isConflict,
                        method: best.method
                    };
                }
            }

            // 4. Fallback / Hybrid Synthesis (if critical data prevents meaningful verification)
            if (!resolvedData.brand) {
                agent.log('synthesis', 'Trust Engine yielded incomplete data. Running fallback synthesis...');
                const combinedSources = searchResults.map((r: any) =>
                    `Source: ${r.url} (${r.source_type})\n---\n${r.markdown}`
                );
                const synthesized = await SynthesisAgent.merge(
                    combinedSources,
                    "StrictConsumableData",
                    apiKeys,
                    agentConfig?.prompts?.synthesis
                );
                // Merge synthesized info where missing, allowing resolvedData to win
                return { ...synthesized, ...resolvedData };
            }

            return resolvedData;
        });

        // 5. Verification
        await step.run("transition-gate-check", () => agent.transition('gate_check'));
        const verification = await step.run("verify-data", async () => {
            const { QualityGatekeeper } = await import("../../services/agents/QualityGatekeeper.js");
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
