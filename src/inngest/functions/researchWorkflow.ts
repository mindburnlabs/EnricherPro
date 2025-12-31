
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
                model, // Pass selected model
                sourceConfig // Pass source configuration for prompt injection
            );
        });

        // 3. Execution (Frontier Loop - Parallel)
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
                // Batch add
                const tasksToAdd = [];
                for (const strategy of plan.strategies) {
                    if (strategy.type === 'domain_crawl' && strategy.target_domain) {
                        await FrontierService.add(jobId, 'domain_crawl', strategy.target_url || strategy.target_domain, 100, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: strategy.schema });
                    } else {
                        for (const query of strategy.queries) {
                            await FrontierService.add(jobId, (strategy.type as any) || 'query', query, 50, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: strategy.schema });
                        }
                    }
                }
            }

            // Loop Config - Reduced concurrency to avoid 429s on free tier
            const defaultBudget = { maxQueries: 5, limitPerQuery: 3, concurrency: 2 };
            const budget = (budgets && budgets[mode]) ? { ...defaultBudget, ...budgets[mode] } : defaultBudget;

            // Total Execution Limit (Safety valve) - Increased for Parallelism
            const MAX_LOOPS = mode === 'deep' ? 15 : 5;
            const CONCURRENCY = budget.concurrency || 3;

            const allResults: any[] = [];
            let loops = 0;

            // Helper for processing a single task
            const processTask = async (task: any) => {
                agent.log('discovery', `prowling frontier: ${task.value} (${task.type})`);
                let results: any[] = [];

                try {
                    // Handle Task Type
                    if (task.type === 'query') {
                        try {
                            const searchOptions: any = {
                                apiKey: apiKeys?.firecrawl,
                                limit: budget.limitPerQuery || 5
                            };

                            // Localization
                            if (language === 'ru') {
                                searchOptions.country = 'ru';
                                searchOptions.lang = 'ru';
                            } else {
                                searchOptions.country = 'us'; // Default to US for English
                                searchOptions.lang = 'en';
                            }

                            const raw = await BackendFirecrawlService.search(task.value, searchOptions);
                            results = raw.map(r => ({ ...r, source_type: 'web' }));
                        } catch (e: any) {
                            // CRITICAL: Explicit Error Handling for User Visibility
                            if (e.statusCode === 429) {
                                console.warn("Firecrawl Rate Limit (429), switching to Fallback...");
                                // Do NOT throw, let it fall through to FallbackSearchService
                            } else if (e.statusCode === 402 || e.message?.includes("Payment Required")) {
                                throw new Error("FAILED: Firecrawl API Credits Exhausted (402). Upgrade plan.");
                            }

                            console.warn("Firecrawl failed, trying fallback", e);
                            const raw = await FallbackSearchService.search(task.value, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback' }));
                        }
                    } else if (task.type === 'domain_crawl') {
                        agent.log('discovery', `Starting Deep Crawl on ${task.value}...`);
                        try {
                            const siteQuery = `site:${task.value} ${plan.canonical_name || plan.mpn || "specs"}`;
                            const raw = await BackendFirecrawlService.search(siteQuery, { apiKey: apiKeys?.firecrawl, limit: 10 });
                            results = raw.map(r => ({ ...r, source_type: 'crawl_result' }));
                        } catch (e) {
                            console.error("Deep Crawl simulation failed", e);
                        }
                    } else if (task.type === 'url') {
                        try {
                            const data = await BackendFirecrawlService.scrape(task.value);
                            if (data) {
                                results.push({
                                    url: (data as any).metadata?.sourceURL || task.value,
                                    title: (data as any).metadata?.title || "Scraped Page",
                                    markdown: (data as any).markdown || "",
                                    source_type: 'direct_scrape'
                                });
                            }
                        } catch (e) {
                            console.warn("URL scrape failed", e);
                        }
                    } else if (task.type === 'firecrawl_agent') {
                        agent.log('discovery', `Deploying Autonomous Agent: ${task.value}`);
                        try {
                            const schema = task.meta && (task.meta as any).schema;
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

                    // STRICT FILTERING: Blocked Domains
                    if (sourceConfig?.blockedDomains?.length > 0) {
                        const originalCount = results.length;
                        results = results.filter(r => {
                            try {
                                const hostname = new URL(r.url).hostname;
                                return !sourceConfig.blockedDomains.some(domain => hostname.includes(domain));
                            } catch (e) {
                                return false; // Invalid URL, drop safely
                            }
                        });
                        if (results.length < originalCount) {
                            agent.log('discovery', `Filtered ${originalCount - results.length} results matching blocked domains.`);
                        }
                    }

                    // Process Results & Persistence
                    for (const r of results) {
                        try {
                            // 1. Save Raw Source Document
                            const sourceDoc = await SourceDocumentRepository.create({
                                jobId,
                                url: r.url,
                                domain: new URL(r.url).hostname,
                                rawContent: r.markdown,
                                status: 'success',
                                extractedMetadata: { title: r.title, type: r.source_type }
                            });

                            // 2. Extract Claims
                            let claims: any[] = [];
                            if (r.source_type === 'agent_result') {
                                try {
                                    const parsed = JSON.parse(r.markdown);
                                    agent.log('synthesis', `Directly ingesting structured data from Agent...`);
                                    // Flatten object to claims (Simplified for brevity, same logic as before)
                                    const flatten = (obj: any, prefix = '') => {
                                        let res: any[] = [];
                                        for (const [key, val] of Object.entries(obj)) {
                                            const fieldKey = prefix ? `${prefix}.${key}` : key;
                                            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                                                res = res.concat(flatten(val, fieldKey));
                                            } else {
                                                res.push({ field: fieldKey, value: val, confidence: 0.9, rawSnippet: "Agent Output" });
                                            }
                                        }
                                        return res;
                                    };
                                    claims = flatten(parsed);
                                } catch (e) {
                                    claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language);
                                }
                            } else {
                                claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language);
                            }

                            // 3. Persist Claims
                            if (claims && claims.length > 0) {
                                await ClaimsRepository.createBatch(claims.map(c => ({
                                    itemId: item.id,
                                    sourceDocId: sourceDoc.id,
                                    field: c.field,
                                    value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
                                    confidence: Math.round((c.confidence || 0.5) * 100)
                                })));
                            }
                        } catch (err) {
                            console.warn(`Failed to process result ${r.url}`, err);
                        }
                    }

                    // 4. Frontier Expansion
                    if (mode !== 'fast' && loops < MAX_LOOPS && results.length > 0) {
                        try {
                            const newQueries = await DiscoveryAgent.analyzeForExpansion(task.value, results.map(r => ({
                                url: r.url,
                                title: r.title,
                                markdown: r.markdown || "",
                                source_type: r.source_type as any,
                                timestamp: new Date().toISOString()
                            })), apiKeys, language);

                            if (newQueries && newQueries.length > 0) {
                                for (const q of newQueries) {
                                    await FrontierService.add(jobId, 'query', q, 40, (task.depth || 0) + 1, { discovered_from: task.value });
                                }
                            }
                        } catch (e) { }
                    }

                    await FrontierService.complete(task.id, 'completed');
                    return results;

                } catch (e: any) {
                    console.error("Frontier task failed", e);
                    await FrontierService.complete(task.id, 'failed');
                    // Re-throw critical errors to abort workflow
                    if (e.message?.startsWith("FAILED:")) throw e;
                    return [];
                }
            };

            // Main Parallel Execution Loop
            while (loops < MAX_LOOPS) {
                const tasks = await FrontierService.nextBatch(jobId, CONCURRENCY);
                if (tasks.length === 0) break;

                loops++;
                agent.log('discovery', `Executing Batch ${loops}: ${tasks.length} tasks in parallel...`);

                // Execute in parallel
                const batchResults = await Promise.all(tasks.map(task => processTask(task)));

                // Flatten and collect results
                batchResults.flat().forEach(r => {
                    allResults.push({
                        url: r.url,
                        title: r.title,
                        markdown: r.markdown,
                        source_type: r.source_type,
                        timestamp: new Date().toISOString()
                    });
                });
            }

            // Logistics Check (Side-quest)
            if (mode !== 'fast' && plan.canonical_name) {
                const logisticsPrompt = agentConfig?.prompts?.logistics;
                const logistics = await LogisticsAgent.checkNixRu(
                    plan.canonical_name,
                    apiKeys,
                    (msg) => agent.log('logistics', msg),
                    logisticsPrompt
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

            // ---------------------------------------------------------
            // ZERO RESULTS RESCUE: Final Safety Net
            // ---------------------------------------------------------
            if (allResults.length === 0) {
                agent.log('discovery', '⚠️ Primary search yielded 0 results. Initiating Emergency Fallback...');
                console.warn(`[ZeroResultsRescue] Job ${jobId}: Main loop finished with 0 results. Triggering rescue.`);

                try {
                    // Try one last broad broad search with the canonical name or raw input
                    const rescueQuery = plan.canonical_name || inputRaw;
                    const rescueResults = await FallbackSearchService.search(rescueQuery, apiKeys);

                    if (rescueResults && rescueResults.length > 0) {
                        agent.log('discovery', `✅ Rescue successful: Found ${rescueResults.length} fallback sources.`);

                        // PERSIST RESCUE RESULTS
                        for (const r of rescueResults) {
                            try {
                                const sourceDoc = await SourceDocumentRepository.create({
                                    jobId,
                                    url: r.url,
                                    domain: new URL(r.url).hostname,
                                    rawContent: r.markdown,
                                    status: 'success',
                                    extractedMetadata: { title: r.title, type: 'fallback_rescue' }
                                });

                                // Basic claim extraction for rescue results too
                                const claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language);
                                if (claims && claims.length > 0) {
                                    await ClaimsRepository.createBatch(claims.map(c => ({
                                        itemId: item.id,
                                        sourceDocId: sourceDoc.id,
                                        field: c.field,
                                        value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
                                        confidence: Math.round((c.confidence || 0.5) * 100)
                                    })));
                                }

                                allResults.push({
                                    url: r.url,
                                    title: r.title,
                                    markdown: r.markdown,
                                    source_type: 'fallback_rescue',
                                    timestamp: new Date().toISOString()
                                });
                            } catch (e) {
                                console.error("Failed to persist rescue result", e);
                            }
                        }
                    } else {
                        agent.log('discovery', '❌ Emergency Rescue failed. No sources found.');
                    }
                } catch (e) {
                    console.error("[ZeroResultsRescue] Rescue failed:", e);
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

            const allClaims = await ClaimsRepository.findByItemId(item.id);
            const claimsByField: Record<string, any[]> = {};
            for (const claim of allClaims) {
                if (!claimsByField[claim.field]) claimsByField[claim.field] = [];
                claimsByField[claim.field].push(claim);
            }

            const resolvedData: any = { _evidence: {} };

            for (const field of Object.keys(claimsByField)) {
                const best = TrustEngine.resolveField(claimsByField[field]);
                if (best) {
                    const parts = field.split('.');
                    let curr = resolvedData;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!curr[parts[i]]) curr[parts[i]] = {};
                        curr = curr[parts[i]];
                    }
                    let val = best.value;
                    try { val = JSON.parse(best.value as any); } catch (e) { }
                    curr[parts[parts.length - 1]] = val;
                    resolvedData._evidence[field] = {
                        value: val,
                        confidence: best.confidence,
                        source_url: best.sources[0],
                        timestamp: new Date().toISOString(),
                        is_conflict: best.isConflict,
                        method: best.method
                    };
                }
            }

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
                    model,
                    language
                );
                return { ...synthesized, ...resolvedData };
            }

            return resolvedData;
        });

        // 5. Verification
        await step.run("transition-gate-check", () => agent.transition('gate_check'));
        const verification = await step.run("verify-data", async () => {
            const { QualityGatekeeper } = await import("../../services/agents/QualityGatekeeper.js");
            // @ts-ignore
            return await QualityGatekeeper.validate(extractedData, language);
        });

        // 6. DB Update & Finalization
        const result = await step.run("finalize-db", async () => {
            // If we have literally 0 results AND the user paid for "deep", fail unless we found *something*
            if (searchResults.length === 0 && mode === 'deep') {
                // But wait, the previous loop might have thrown. 
                // If we made it here, no critical API error occurred, just empty results.
                // We rely on standard failure from Orchestrator if fail() was called.
            }
            return await agent.complete(verification, extractedData);
        });

        return {
            success: true,
            ...result
        };
    }
);
