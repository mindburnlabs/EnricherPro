
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
        const { jobId, tenantId, inputRaw, mode = 'balanced', forceRefresh, apiKeys, agentConfig, sourceConfig, budgets, previousJobId, language = 'en', model } = event.data;
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
                language, // Pass language
                model // Pass selected model
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
                    if (strategy.type === 'domain_crawl' && strategy.target_domain) {
                        // Seed explicit crawl if present in plan
                        // We seed a root URL or search to find root
                        await FrontierService.add(jobId, 'domain_crawl', strategy.target_url || strategy.target_domain, 100, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: strategy.schema });
                    } else {
                        for (const query of strategy.queries) {
                            // Pass schema if present (for firecrawl_agent)
                            await FrontierService.add(jobId, (strategy.type as any) || 'query', query, 50, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: strategy.schema });
                        }
                    }
                }
            }

            // Loop Config
            const defaultBudget = { maxQueries: 5, limitPerQuery: 3 };
            const budget = (budgets && budgets[mode]) ? budgets[mode] : defaultBudget;

            const MAX_STEPS = budget.maxQueries || (mode === 'deep' ? 20 : 10);
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
                            const raw = await BackendFirecrawlService.search(task.value, {
                                apiKey: apiKeys?.firecrawl,
                                limit: budget.limitPerQuery || 5
                            });
                            results = raw.map(r => ({ ...r, source_type: 'web' }));
                        } catch (e) {
                            console.warn("Firecrawl failed, trying fallback", e);
                            const raw = await FallbackSearchService.search(task.value, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback' }));
                        }
                    } else if (task.type === 'domain_crawl') {
                        agent.log('discovery', `Starting Deep Crawl on ${task.value}...`);
                        try {
                            // Use 'site:domain' search as a synchronous "Deep Scan" proxy 
                            // Real async crawl is tricky in a single sync loop step without blocking for minutes.
                            // This is a robust "Instant Deep" implementation.
                            const siteQuery = `site:${task.value} ${plan.canonical_name || plan.mpn || "specs"}`;
                            const raw = await BackendFirecrawlService.search(siteQuery, { apiKey: apiKeys?.firecrawl, limit: 10 });
                            results = raw.map(r => ({ ...r, source_type: 'crawl_result' }));
                        } catch (e) {
                            console.error("Deep Crawl simulation failed", e);
                        }
                    } else if (task.type === 'url') {
                        // Direct scrape
                        try {
                            const data = await BackendFirecrawlService.extract([task.value], {});
                            if (Array.isArray(data) && data[0]) {
                                results.push({
                                    url: task.value,
                                    title: data[0].metadata?.title || "Scraped URL",
                                    markdown: data[0].markdown || "",
                                    source_type: 'direct_scrape'
                                });
                            }
                        } catch (e) { console.warn("URL scrape failed", e); }
                    } else if (task.type === 'firecrawl_agent') {
                        // Autonomous Agent
                        agent.log('discovery', `Deploying Autonomous Agent: ${task.value}`);
                        try {
                            // Extract schema from task metadata if available
                            const schema = task.meta && (task.meta as any).schema;
                            if (schema) {
                                agent.log('discovery', `Agent Schema: ${JSON.stringify(schema, null, 2)}`);
                            }
                            const data = await BackendFirecrawlService.agent(task.value, { apiKey: apiKeys?.firecrawl, schema });
                            if (data) {
                                results.push({
                                    url: (data as any).metadata?.sourceURL || "agent-session",
                                    title: (data as any).metadata?.title || "Agent Result",
                                    markdown: (data as any).markdown || JSON.stringify(data),
                                    source_type: 'agent_result'
                                });
                            }
                        } catch (e) {
                            console.error("Firecrawl Agent failed", e);
                        }
                    }

                    // Process Results & Evidence Persistence
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
                        let sourceDocId: string | undefined;
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
                            // OPTIMIZATION: If source is 'agent_result' with structured JSON, ingest directly!
                            // "Can we do better?" -> Yes, by trusting the Agent's structured output.
                            let claims: any[] = [];

                            if (r.source_type === 'agent_result') {
                                try {
                                    // Agent returns stringified JSON in markdown field for storage
                                    const parsed = JSON.parse(r.markdown);
                                    agent.log('synthesis', `Directly ingesting structured data from Agent...`);

                                    // Map structured JSON to Claim objects
                                    // Flatten object to claims
                                    const flatten = (obj: any, prefix = '') => {
                                        let res: any[] = [];
                                        for (const [key, val] of Object.entries(obj)) {
                                            const fieldKey = prefix ? `${prefix}.${key}` : key;
                                            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                                                res = res.concat(flatten(val, fieldKey));
                                            } else {
                                                // It's a value (string, number, array of strings)
                                                res.push({
                                                    field: fieldKey,
                                                    value: val,
                                                    confidence: 0.95, // High confidence in Agent
                                                    rawSnippet: "Agent Structured Output"
                                                });
                                            }
                                        }
                                        return res;
                                    };
                                    claims = flatten(parsed);
                                } catch (e) {
                                    console.warn("Failed to parse Agent JSON, falling back to LLM extraction", e);
                                    claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model);
                                }
                            } else {
                                // Standard Path: LLM Extraction from raw text
                                claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model);
                            }

                            // 3. Persist Claims
                            if (claims && claims.length > 0) {
                                await ClaimsRepository.createBatch(claims.map(c => ({
                                    itemId: item.id,
                                    sourceDocId: sourceDocId || sourceDoc.id, // Ensure ID availability
                                    field: c.field,
                                    value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
                                    confidence: Math.round((c.confidence || 0.5) * 100)
                                })));
                                agent.log('synthesis', `Persisted ${claims.length} claims from ${r.url}`);
                            }
                        } catch (err) {
                            console.warn(`Failed to process evidence for ${r.url}`, err);
                        }
                    }

                    // 4. Frontier Expansion (Phase A)
                    // If we found good results, maybe expand with more specific queries
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
                    agentConfig?.prompts?.synthesis,
                    undefined,
                    model
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
