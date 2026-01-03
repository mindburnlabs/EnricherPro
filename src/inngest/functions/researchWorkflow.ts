
import { inngest } from "../client.js";
import { OrchestratorAgent } from "../../services/agents/OrchestratorAgent.js";
import { DiscoveryAgent, AgentPlan } from "../../services/agents/DiscoveryAgent.js";
import { z } from "zod";
import type { ResearchEventData, ResearchResult, hasEvidence, createGraphLiteUrl } from "../../types/workflow.js";

// Strict Schema for DB Claims
const SafeClaimSchema = z.object({
    field: z.string().min(1),
    value: z.any().transform(v => typeof v === 'object' ? JSON.stringify(v) : String(v)),
    confidence: z.number().default(50),
});

export const researchWorkflow = inngest.createFunction(
    {
        id: "research-workflow",
        concurrency: { limit: 5 },
        retries: 3,
        onFailure: async ({ event, error }) => {
            const eventData = (event as any).event?.data || event.data;
            const { jobId } = eventData as ResearchEventData;
            console.error(`[Workflow Failed] Job ${jobId}:`, error);
            const agent = new OrchestratorAgent(jobId);
            await agent.fail(error);
        }
    },
    { event: "app/research.started" },
    async ({ event, step }) => {
        const { jobId, tenantId, inputRaw, mode = 'balanced', forceRefresh, apiKeys, agentConfig, sourceConfig, budgets, previousJobId, language = 'en', model, useFlashPlanner = true } = event.data as any; // Cast to any to handle custom event payload
        const agent = new OrchestratorAgent(jobId, apiKeys, tenantId);

        // 1. Initialize DB Record
        const { item, isCached } = await step.run("create-db-item", async () => {
            return await agent.getOrCreateItem(inputRaw, forceRefresh);
        });

        // EFFICIENCY UPGRADE: Cache Hit
        if (isCached) {
            await step.run("log-cache-hit", () => agent.log('orchestrator', '⚡ Using cached data from Database. Skipping research.'));
            return {
                success: true,
                itemId: item.id,
                status: item.status,
                cached: true,
                _evidence: item.data?._evidence // Pass through evidence if needed for UI immediate render
            };
        }

        // REFINEMENT CONTEXT
        let context = undefined;
        if (previousJobId) {
            context = await step.run("fetch-context", async () => {
                return await agent.getContext(previousJobId) || undefined;
            });
        }

        // 2. Planning (HYDRA UPGRADE)
        await step.run("transition-planning", () => agent.transition('planning'));
        const plan = await step.run("generate-plan", async () => {
            const { DiscoveryAgent } = await import("../../services/agents/DiscoveryAgent.js");
            const { StrategyRacer } = await import("../../services/logic/StrategyRacer.js");

            // HYDRA HEAD 1: Fast Guesser (Zero Latency)
            // If we can regex-match a likely URL, we skip the LLM Planner entirely.
            // This transforms the system from "Reactive" to "Predictive".
            const guessedUrl = StrategyRacer.guessUrl(inputRaw);
            if (guessedUrl) {
                // Verify strictness: Only skip plan if we are confident.
                // For B2B/MPN lookups, this is usually safe and much faster.
                agent.log('discovery', `🐉 Hydra: Guesser predicted direct URL: ${guessedUrl}. Bypassing Planner.`);
                return {
                    type: "single_sku",
                    mpn: null,
                    canonical_name: inputRaw,
                    strategies: [{
                        name: "Hydra Direct Guess",
                        type: "url", // Frontier handles 'url' types by scraping
                        queries: [], // No queries needed
                        target_domain: new URL(guessedUrl).hostname,
                        target_url: guessedUrl
                    }],
                    suggestedBudget: { mode: 'fast', concurrency: 2, depth: 0 }
                };
            }

            return await DiscoveryAgent.plan(
                inputRaw,
                mode,
                apiKeys,
                agentConfig?.prompts?.discovery,
                (msg) => agent.log('discovery', msg),
                context, // Pass context
                language, // Pass language
                model, // Pass selected model
                sourceConfig, // Pass source configuration for prompt injection
                useFlashPlanner // Pass Flash Planner configuration
            );
        });

        // 3. Execution (Frontier Loop - Time Sliced SOTA)
        await step.run("transition-searching", () => agent.transition('searching'));

        // HOISTED IMPORTS & SHARED HELPERS
        const { FrontierService } = await import("../../services/frontier/FrontierService.js");
        const { BackendFirecrawlService } = await import("../../services/backend/firecrawl.js");
        const { FallbackSearchService } = await import("../../services/backend/fallback.js");
        const { LogisticsAgent } = await import("../../services/agents/LogisticsAgent.js");
        const { SourceDocumentRepository } = await import("../../repositories/SourceDocumentRepository.js");
        const { ClaimsRepository } = await import("../../repositories/ClaimsRepository.js");
        const { SynthesisAgent } = await import("../../services/agents/SynthesisAgent.js");
        const { DiscoveryAgent } = await import("../../services/agents/DiscoveryAgent.js");
        const { EnrichmentAgent } = await import("../../services/agents/EnrichmentAgent.js");

        let searchResults: any[] = [];
        let isFirecrawlExhausted = false; // Graceful degradation flag

        // Helper: Process Task (Hoisted)
        const processTask = async (task: any) => {
            agent.log('discovery', `prowling frontier: ${task.value} (${task.type})`);
            let results: any[] = [];

            try {
                // Handle Task Type
                if (task.type === 'query') {
                    try {
                        // Check flag just in case
                        if (isFirecrawlExhausted) throw new Error("Skipping Firecrawl (Credits exhausted)");

                        const searchOptions: any = {
                            apiKey: apiKeys?.firecrawl,
                            limit: 5 // Default budget limit
                        };

                        // Localization
                        if (language === 'ru') {
                            searchOptions.country = 'ru';
                            searchOptions.lang = 'ru';
                        } else {
                            searchOptions.country = 'us'; // Default to US for English
                            searchOptions.lang = 'en';
                        }

                        // VISIBILITY UPGRADE: Log Retry/Pauses
                        searchOptions.onRetry = (attempt: number, error: any, delay: number) => {
                            if (delay > 2000) {
                                agent.log('system', `⏳ Rate Limit Hit. Pausing research for ${Math.round(delay / 1000)}s...`);
                            }
                        };

                        // FIRESEARCH UPGRADE: Select-then-Scrape Pattern
                        const metadataResults = await BackendFirecrawlService.search(task.value, searchOptions);

                        // 2. SOTA Smart Relevance Filter (AI Judge)
                        let selectedIndices: number[] = [];
                        try {
                            selectedIndices = await DiscoveryAgent.filterResults(metadataResults, task.value, apiKeys, 'en', (msg) => agent.log('discovery', msg));
                            agent.log('discovery', `🧠 AI Judge selected ${selectedIndices.length}/${metadataResults.length} candidates.`);
                        } catch (e) {
                            selectedIndices = [0, 1, 2].filter(i => i < metadataResults.length);
                        }

                        const candidates = selectedIndices.map(i => metadataResults[i]);

                        if (candidates.length > 0) {
                            for (const candidate of candidates) {
                                const c = candidate as any;
                                if (c.url) {
                                    await FrontierService.add(jobId, 'url', c.url, 60, (task.depth || 0), {
                                        source: 'search_selection',
                                        title: c.title || "Selected Search Result"
                                    });
                                }
                            }
                            results = []; // Query itself yields no content, just spawns tasks.
                        } else {
                            // Fallback: If AI says 0, take Top 1 just to be safe (Strict Truth)
                            if (metadataResults.length > 0) {
                                agent.log('discovery', `⚠️ AI Filter blocked all. Forcing Top 1 Fallback.`);
                                const fallback = metadataResults[0] as any;
                                if (fallback.url) {
                                    await FrontierService.add(jobId, 'url', fallback.url, 60, (task.depth || 0), {
                                        source: 'fallback_selection',
                                        title: fallback.title
                                    });
                                }
                                results = [];
                            } else {
                                throw new Error("Zero Results");
                            }
                        }
                    } catch (e: any) {
                        // CRITICAL: Explicit Error Handling for User Visibility
                        const isMissingKey = e.message?.includes("Missing Firecrawl API Key");
                        const isZeroResults = e.message === "Zero Results";
                        const isAuthError = e.statusCode === 401 || e.statusCode === 403;
                        const isPaymentError = e.statusCode === 402 || e.message?.includes("Payment Required") || e.message?.includes("Insufficient credits");
                        const isRateLimit = e.statusCode === 429;

                        if (isPaymentError) {
                            isFirecrawlExhausted = true; // Set Global Flag
                            agent.log('system', `💸 Firecrawl Credits Exhausted. Switching to Fallback Search for remainder of job.`);
                        }

                        if (isMissingKey || isAuthError || isPaymentError || isRateLimit || isZeroResults) {
                            agent.log('discovery', `⚠️ Firecrawl unavailable (${isMissingKey ? 'No Key' : isZeroResults ? '0 Results' : isPaymentError ? 'No Credits' : e.statusCode || 'Error'}). Switching to Fallback Search.`);
                        } else {
                            console.warn("Firecrawl failed with unexpected error, trying fallback", e);
                        }

                        try {
                            const raw = await FallbackSearchService.search(task.value, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback' }));
                        } catch (fallbackErr) {
                            console.error("Fallback search also failed", fallbackErr);
                            results = [];
                        }
                    }
                } else if (task.type === 'domain_crawl') {
                    // ... implementation similar to original
                    agent.log('discovery', `Starting Deep Map on ${task.value}...`);
                    try {
                        if (isFirecrawlExhausted) throw new Error("Skipping Firecrawl");
                        const mapResults = await BackendFirecrawlService.map(task.value, {
                            limit: 50,
                            search: plan.canonical_name || undefined,
                            apiKey: apiKeys?.firecrawl
                        });

                        if (mapResults && mapResults.length > 0) {
                            agent.log('discovery', `Mapped ${mapResults.length} pages on ${task.value}`);
                            const newTasksArg = mapResults.map(l => ({
                                type: 'url',
                                value: l.url,
                                depth: (task.depth || 0) + 1,
                                meta: { source: 'map', title: l.title }
                            }));
                            for (const subTask of newTasksArg) {
                                await FrontierService.add(jobId, 'url', subTask.value, 40, subTask.depth as number, subTask.meta);
                            }
                            results = [];
                        } else {
                            const siteQuery = `site:${task.value} ${plan.canonical_name || plan.mpn || "specs"}`;
                            const raw = await BackendFirecrawlService.search(siteQuery, { apiKey: apiKeys?.firecrawl, limit: 10 });
                            results = raw.map(r => ({ ...r, source_type: 'crawl_result' }));
                        }
                    } catch (e: any) {
                        if (e.statusCode === 402) isFirecrawlExhausted = true;
                        // FALLBACK
                        const siteQuery = `site:${task.value} ${plan.canonical_name || plan.mpn || "specs"}`;
                        try {
                            const raw = await FallbackSearchService.search(siteQuery, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback_map' }));
                        } catch (fallbackErr) { }
                    }
                } else if (task.type === 'deep_crawl') {
                    // Check if we can use Firecrawl
                    if (isFirecrawlExhausted) {
                        const siteQuery = `site:${task.value} ${plan.canonical_name || "product details"}`;
                        try {
                            const raw = await FallbackSearchService.search(siteQuery, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback_crawl' }));
                        } catch (e) { }
                    } else {
                        try {
                            // Launch Crawl
                            const crawlId = await BackendFirecrawlService.crawl(task.value, {
                                limit: 10,
                                maxDepth: 2,
                                apiKey: apiKeys?.firecrawl
                            });
                            agent.log('discovery', `🕷️ Started Deep Crawl ${crawlId} for ${task.value}`);
                            await FrontierService.add(jobId, 'crawl_status', crawlId, 50, task.depth || 0, { original_url: task.value });
                            results = [];
                        } catch (e: any) {
                            if (e.statusCode === 402) {
                                isFirecrawlExhausted = true;
                                // Retry with Fallback immediately
                                const siteQuery = `site:${task.value} ${plan.canonical_name || "product details"}`;
                                try {
                                    const raw = await FallbackSearchService.search(siteQuery, apiKeys);
                                    results = raw.map(r => ({ ...r, source_type: 'fallback_crawl' }));
                                } catch (fbErr) { }
                            }
                        }
                    }
                } else if (task.type === 'crawl_status') {
                    const crawlId = task.value;
                    try {
                        const status = await BackendFirecrawlService.checkCrawlStatus(crawlId, apiKeys?.firecrawl);

                        if (status?.status === 'completed') {
                            const data = status.data || [];
                            agent.log('discovery', `✅ Deep Crawl ${crawlId} finished! Found ${data.length} pages.`);
                            results = data.map((d: any) => ({
                                url: d.metadata?.sourceURL || d.url || "unknown",
                                title: d.metadata?.title || "Crawl Result",
                                markdown: d.markdown || "",
                                source_type: 'deep_crawl'
                            }));
                        } else if (status?.status === 'failed') {
                            agent.log('discovery', `❌ Deep Crawl ${crawlId} failed.`);
                        } else {
                            // Still active - Queue a new check
                            await FrontierService.add(jobId, 'crawl_status', crawlId, 50, task.depth || 0, task.meta);
                        }
                    } catch (e) {
                        console.error("Crawl status check failed", e);
                    }
                } else if (task.type === 'url') {
                    try {
                        let cachedDoc = null;
                        try {
                            cachedDoc = await SourceDocumentRepository.findByUrl(task.value);
                        } catch (e) { /* ignore db errors */ }

                        const isFresh = cachedDoc && (Date.now() - new Date(cachedDoc.crawledAt).getTime() < 86400000);

                        if (isFresh && cachedDoc?.rawContent) {
                            agent.log('discovery', `⚡ Cache Hit (Global): ${task.value}`);
                            results.push({
                                url: task.value,
                                title: (cachedDoc.extractedMetadata as any)?.title || "Cached Page",
                                markdown: cachedDoc.rawContent,
                                screenshot: (cachedDoc.extractedMetadata as any)?.screenshot || null,
                                source_type: 'direct_scrape'
                            });
                        } else {
                            if (isFirecrawlExhausted) throw new Error("Skipping Firecrawl");
                            const data = await BackendFirecrawlService.scrape(task.value, {
                                formats: ['markdown'],
                                actions: task.meta?.actions,
                                location: task.meta?.location,
                                waitFor: task.meta?.waitFor,
                                mobile: task.meta?.mobile,
                                maxAge: 86400,
                                apiKey: apiKeys?.firecrawl,
                                onRetry: (attempt: number, error: any, delay: number) => {
                                    if (delay > 2000) {
                                        agent.log('system', `⏳ Rate Limit Hit for ${task.value}. Pausing for ${Math.round(delay / 1000)}s...`);
                                    }
                                }
                            });
                            if (data) {
                                results.push({
                                    url: (data as any).metadata?.sourceURL || task.value,
                                    title: (data as any).metadata?.title || "Scraped Page",
                                    markdown: (data as any).markdown || "",
                                    screenshot: (data as any).screenshot || null,
                                    source_type: 'direct_scrape'
                                });
                            }
                        }
                    } catch (e: any) {
                        if (e.statusCode === 402) isFirecrawlExhausted = true;

                        if (e.message?.includes("Missing Firecrawl API Key") || e.statusCode === 402 || isFirecrawlExhausted) {
                            try {
                                agent.log('discovery', `⚠️ Scrape disabled (No Key/Credits). Asking Fallback Agent about: ${task.value}`);
                                const raw = await FallbackSearchService.search(`summarize content of ${task.value}`, apiKeys);
                                if (raw && raw.length > 0) {
                                    results.push({
                                        url: task.value,
                                        title: raw[0].title || "Fallback Summary",
                                        markdown: raw[0].markdown,
                                        source_type: 'fallback_scrape'
                                    });
                                }
                            } catch (fbErr) { }
                        }
                    }
                } else if (task.type === 'domain_map') {
                    // ...
                    const queries = task.meta?.queries || [plan.canonical_name || inputRaw];
                    try {
                        if (isFirecrawlExhausted) throw new Error("Skipping map");
                        const mapResults = await BackendFirecrawlService.map(task.value, {
                            limit: 5,
                            search: queries.join(' '),
                            apiKey: apiKeys?.firecrawl
                        });

                        if (mapResults && mapResults.length > 0) {
                            const relevantIndices = await DiscoveryAgent.filterResults(mapResults, queries.join(' '), apiKeys, 'en', (msg) => agent.log('discovery', msg));
                            const filteredLinks = relevantIndices.map(i => mapResults[i]);
                            for (const l of filteredLinks) {
                                if (l.url) await FrontierService.add(jobId, 'url', l.url, 60, (task.depth || 0) + 1, { source: 'domain_map', title: l.title });
                            }
                            results = [];
                        } else {
                            await FrontierService.add(jobId, 'query', `site:${task.value} ${queries.join(' ')}`, 50, task.depth || 0);
                            results = [];
                        }
                    } catch (e: any) {
                        if (e.statusCode === 402) isFirecrawlExhausted = true;
                        try {
                            const raw = await FallbackSearchService.search(`site:${task.value} ${queries.join(' ')}`, apiKeys);
                            results = raw.map(r => ({ ...r, source_type: 'fallback_map' }));
                        } catch (err) { }
                    }
                } else if (task.type === 'enrichment') {
                    // ...
                    let success = false;
                    try {
                        if (isFirecrawlExhausted) throw new Error("Skipping enrich");
                        const goal = task.meta?.goal || "Extract all product details";
                        const schema = await EnrichmentAgent.generateSchema(goal, task.value, language, model, apiKeys, agentConfig?.prompts?.enrichment, (msg) => agent.log('discovery', msg));

                        const data = await BackendFirecrawlService.enrich(task.value, schema, {
                            apiKey: apiKeys?.firecrawl,
                            actions: task.meta?.actions,
                            location: task.meta?.location,
                            mobile: task.meta?.mobile,
                            waitFor: task.meta?.waitFor
                        });
                        if (data) {
                            results.push({ url: task.value, title: "Enriched Data", markdown: JSON.stringify(data), source_type: 'agent_result' });
                            success = true;
                        }
                    } catch (e: any) {
                        if (e.statusCode === 402) isFirecrawlExhausted = true;
                    }

                    if (!success) {
                        try {
                            if (isFirecrawlExhausted) throw new Error("Skipping fallback scrape");
                            const raw = await BackendFirecrawlService.scrape(task.value, { actions: task.meta?.actions, location: task.meta?.location, apiKey: apiKeys?.firecrawl });
                            if (raw) results.push({ url: task.value, title: (raw as any).metadata?.title, markdown: (raw as any).markdown, source_type: 'direct_scrape' });
                        } catch (err: any) {
                            if (err.statusCode === 402) isFirecrawlExhausted = true;
                            // Final Fallback
                            try {
                                const raw = await FallbackSearchService.search(`summarize content of ${task.value}`, apiKeys);
                                if (raw[0]) results.push({ url: task.value, title: raw[0].title, markdown: raw[0].markdown, source_type: 'fallback_enrichment' });
                            } catch (final) { }
                        }
                    }
                }

                // STRICT FILTERING: Blocked Domains
                if (sourceConfig?.blockedDomains?.length > 0) {
                    results = results.filter(r => {
                        try { return !sourceConfig.blockedDomains.some(domain => new URL(r.url).hostname.includes(domain)); }
                        catch (e) { return false; }
                    });
                }

                // Persistence
                for (const r of results) {
                    try {
                        const sourceDoc = await SourceDocumentRepository.create({
                            jobId, url: r.url, domain: new URL(r.url).hostname, rawContent: r.markdown, status: 'success',
                            extractedMetadata: { title: r.title, type: r.source_type, screenshot: (r as any).screenshot }
                        });

                        // Extract Claims
                        let claims: any[] = [];
                        try {
                            claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language, (r as any).screenshot);
                        } catch (e) { }

                        if (claims && claims.length > 0) {
                            const validClaims = claims.map(c => {
                                const result = SafeClaimSchema.safeParse(c);
                                if (!result.success) return null;
                                return { itemId: item.id, sourceDocId: sourceDoc.id, field: result.data.field, value: result.data.value, confidence: Math.round(result.data.confidence) };
                            }).filter(Boolean);
                            if (validClaims.length > 0) await ClaimsRepository.createBatch(validClaims as any);
                        }
                    } catch (e) { }
                }

                await FrontierService.complete(task.id, 'completed');
                return results;

            } catch (e: any) {
                console.error("Frontier task failed", e);
                await FrontierService.complete(task.id, 'failed');
                if (e.message?.startsWith("FAILED:")) throw e;
                return [];
            }
        };

        // Helper: Process Batch
        const processUrlBatch = async (tasks: any[]) => {
            const urls = tasks.map(t => t.value);
            agent.log('discovery', `📦 Batch Scraping ${urls.length} URLs...`);
            let batchResults: any[] = [];

            if (isFirecrawlExhausted) {
                // Skip batch, go to fallback individually
                return { count: 0, results: [] }; // The caller will retry individually using processTask which has fallback
            }

            try {
                const results = await BackendFirecrawlService.batchScrape(urls, {
                    apiKey: apiKeys?.firecrawl,
                    formats: ['markdown', 'screenshot'],
                    maxAge: 86400,
                    timeout: 30000,
                    onRetry: (attempt, error, delay) => { if (delay > 2000) agent.log('system', `⏳ Batch Rate Limit. Pausing ${Math.round(delay / 1000)}s...`); }
                });

                let processedCount = 0;
                for (const task of tasks) {
                    const result = results.find((r: any) => r.metadata?.sourceURL === task.value || r.url === task.value);
                    if (result) {
                        batchResults.push({
                            url: result.metadata?.sourceURL || task.value,
                            title: result.metadata?.title || "Scraped Page",
                            markdown: result.markdown || "",
                            source_type: 'direct_scrape_batch',
                            timestamp: new Date().toISOString()
                        });
                        await FrontierService.complete(task.id, 'completed');
                        processedCount++;
                    } else {
                        await FrontierService.complete(task.id, 'failed');
                    }
                }
                return { count: processedCount, results: batchResults };
            } catch (e: any) {
                if (e.statusCode === 402) isFirecrawlExhausted = true;
                agent.log('discovery', `⚠️ Batch Run Failed. Retrying ${tasks.length} tasks individually.`);
                // Return empty so caller falls back to individual tasks logic
                return { count: 0, results: [] };
            }
        };

        // Graph-Lite Path
        const planWithEvidence = plan as AgentPlan & { evidence?: Record<string, any> };
        if (planWithEvidence.evidence) {
            searchResults = await step.run("graph-lite-execution", async () => {
                agent.log('discovery', '⚡ Graph-Lite Hit! Skipping web search to prioritize local knowledge.');
                const graphUrl = `graph://${plan.mpn || 'internal'}`;
                const sourceDoc = await SourceDocumentRepository.create({
                    jobId, url: graphUrl, domain: 'graph-lite.internal', rawContent: JSON.stringify(planWithEvidence.evidence), status: 'success', extractedMetadata: { title: "Graph-Lite Entry", type: "graph_lite" }
                });
                // Flatten Claims logic...
                const flatten = (obj: any, prefix = '') => {
                    let res: any[] = [];
                    for (const [key, val] of Object.entries(obj)) {
                        if (key === '_evidence') continue;
                        const fieldKey = prefix ? `${prefix}.${key}` : key;
                        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                            res = res.concat(flatten(val, fieldKey));
                        } else {
                            res.push({ field: fieldKey, value: val });
                        }
                    }
                    return res;
                };
                const flatClaims = flatten(planWithEvidence.evidence);
                if (flatClaims.length > 0) {
                    await ClaimsRepository.createBatch(flatClaims.map((c: any) => ({
                        itemId: item.id, sourceDocId: sourceDoc.id, field: c.field, value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value), confidence: 99
                    })));
                }
                return [{ url: graphUrl, title: "Graph-Lite", markdown: JSON.stringify(planWithEvidence.evidence), source_type: 'graph_lite' as const, timestamp: new Date().toISOString() }];
            });
        } else {
            // STANDARD FRONTIER EXECUTION

            // 1. Seed Frontier
            await step.run("seed-frontier", async () => {
                if (plan.strategies) {
                    for (const strategy of plan.strategies) {
                        if (strategy.type === 'url' && strategy.target_url) {
                            await FrontierService.add(jobId, 'url', strategy.target_url, 100, 0, { strategy: strategy.name });
                        }
                        else if (strategy.type === 'domain_crawl' && strategy.target_domain) {
                            await FrontierService.add(jobId, 'domain_crawl', strategy.target_url || strategy.target_domain, 100, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: (strategy as any).schema });
                        } else if (strategy.type === 'domain_map' && strategy.target_domain) {
                            await FrontierService.add(jobId, 'domain_map', strategy.target_domain, 100, 0, { strategy: strategy.name, queries: strategy.queries, schema: (strategy as any).schema });
                        } else {
                            for (const query of strategy.queries) {
                                await FrontierService.add(jobId, (strategy.type as any) || 'query', query, 50, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: (strategy as any).schema });
                            }
                        }
                    }
                }
            });

            // 2. Sliced Execution Loop
            // REPLACED THE OLD GIANT STEP WITH THIS LOOP

            // Loop Config
            let defaultBudget = { maxQueries: 10, limitPerQuery: 5, concurrency: 8 }; // UPGRADED to 8
            let MAX_LOOPS = mode === 'deep' ? 15 : 5;
            if (plan.suggestedBudget) {
                defaultBudget.concurrency = plan.suggestedBudget.concurrency;
                if (plan.suggestedBudget.mode === 'deep') MAX_LOOPS = 15;
                else if (plan.suggestedBudget.mode === 'fast') MAX_LOOPS = 2;
                else MAX_LOOPS = 7;
            }
            const budget = (budgets && budgets[mode]) ? { ...defaultBudget, ...budgets[mode] } : defaultBudget;
            const CONCURRENCY = budget.concurrency || 5;

            let done = false;
            let sliceIndex = 0;
            const MAX_SLICES = 30; // Hard limit on steps

            agent.log('discovery', `🚀 Starting Sliding Window Execution (Target: ${CONCURRENCY} concurrent threads)...`);

            while (!done && sliceIndex < MAX_SLICES) {
                const sliceOutput = await step.run(`frontier-slice-${sliceIndex}`, async () => {
                    // HARD TIMEOUT: 45s per slice
                    const SLICE_DURATION = 40000; // 40s to be safe
                    const startTime = Date.now();
                    const drainingStart = startTime + SLICE_DURATION - 5000;

                    const sliceResults: any[] = [];
                    const activePromises = new Set<Promise<any>>();

                    // Check stats
                    const initialStats = await FrontierService.stats(jobId);
                    if (initialStats.pending === 0 && initialStats.processing === 0 && activePromises.size === 0) {
                        // Only mark done if pool empty
                        return { results: [], done: true, exhausted: isFirecrawlExhausted };
                    }

                    // Run loop until time up
                    while (Date.now() < drainingStart) {
                        const freeSlots = CONCURRENCY - activePromises.size;
                        if (freeSlots > 0) {
                            const tasks = await FrontierService.nextBatch(jobId, freeSlots);
                            if (tasks.length > 0) {
                                // Separate URL for Batching
                                const urlTasks = tasks.filter(t => t.type === 'url');
                                const otherTasks = tasks.filter(t => t.type !== 'url');

                                if (urlTasks.length > 1) {
                                    const p = processUrlBatch(urlTasks).then(async (res) => {
                                        if (res.results && res.results.length > 0) {
                                            sliceResults.push(...res.results);
                                        }
                                        // If batch failed/skipped, retry individually
                                        if (res.count === 0 && res.results.length === 0) {
                                            for (const t of urlTasks) {
                                                try {
                                                    const indRes = await processTask(t);
                                                    if (indRes) sliceResults.push(...indRes);
                                                } catch (e) { }
                                            }
                                        }
                                        activePromises.delete(p);
                                    });
                                    activePromises.add(p);
                                } else if (urlTasks.length === 1) {
                                    otherTasks.push(urlTasks[0]);
                                }

                                for (const t of otherTasks) {
                                    const p = processTask(t).then((res) => {
                                        if (res) sliceResults.push(...res);
                                        activePromises.delete(p);
                                    });
                                    activePromises.add(p);
                                }
                            } else {
                                // Queue Empty: Wait for active tasks
                                if (activePromises.size === 0) {
                                    return { results: sliceResults, done: true, exhausted: isFirecrawlExhausted };
                                }
                                await Promise.race(activePromises);
                            }
                        } else {
                            // Pool Full: Wait for one
                            await Promise.race(activePromises);
                        }
                    }

                    // Time Up: Drain Active
                    if (activePromises.size > 0) {
                        agent.log('system', `⏳ Slice ${sliceIndex} check: Draining ${activePromises.size} active tasks...`);
                        await Promise.all(activePromises);
                    }

                    return { results: sliceResults, done: false, exhausted: isFirecrawlExhausted };
                });

                if (Array.isArray(sliceOutput.results)) {
                    searchResults.push(...sliceOutput.results);
                }

                if (sliceOutput.done) done = true;
                if (sliceOutput.exhausted) isFirecrawlExhausted = true; // State rehydration
                sliceIndex++;
            }

            // Zero Results Rescue
            if (searchResults.length === 0) {
                agent.log('discovery', '⚠️ Primary search yielded 0 results. Initiating Emergency Fallback...');
                try {
                    const rescueQuery = plan.canonical_name || inputRaw;
                    const rescueResults = await FallbackSearchService.search(rescueQuery, apiKeys);
                    if (rescueResults && rescueResults.length > 0) {
                        for (const r of rescueResults) {
                            // Save & Push
                            try {
                                const sourceDoc = await SourceDocumentRepository.create({
                                    jobId, url: r.url, domain: new URL(r.url).hostname, rawContent: r.markdown, status: 'success', extractedMetadata: { title: r.title, type: 'fallback_rescue' }
                                });
                                let claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language);
                                if (claims && claims.length > 0) await ClaimsRepository.createBatch(claims.map(c => ({ itemId: item.id, sourceDocId: sourceDoc.id, field: c.field, value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value), confidence: 50 })));

                                searchResults.push({ url: r.url, title: r.title, markdown: r.markdown, source_type: 'fallback_rescue', timestamp: new Date().toISOString() });
                            } catch (e) { }
                        }
                    }
                } catch (e) { }
            }

            // Logistics
            if (mode !== 'fast' && plan.canonical_name) {
                const logistics = await LogisticsAgent.checkNixRu(plan.canonical_name, apiKeys, (msg) => agent.log('logistics', msg), undefined, undefined, language);
                if (logistics.url) searchResults.push({ url: logistics.url, title: "Logistics", markdown: `Weight: ${logistics.weight}`, source_type: 'nix_ru', timestamp: new Date().toISOString() });
            }
        }

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
                        value: val, confidence: best.confidence, source_url: best.sources[0], timestamp: new Date().toISOString(), is_conflict: best.isConflict, method: best.method
                    };
                }
            }

            if (!resolvedData.brand) {
                agent.log('synthesis', 'Trust Engine yielded incomplete data. Activating Swarm Synthesis...');
                const safeResults = searchResults || [];
                const combinedSources = safeResults.map((r: any) => `Source: ${r.url} (${r.source_type})\n Title: ${r.title}\n---\n${r.markdown}`);

                const synthesized = await SynthesisAgent.merge(combinedSources, "StrictConsumableData", apiKeys, agentConfig?.prompts?.synthesis, (msg) => agent.log('synthesis', msg), model, language, inputRaw);

                // DYNAMIC REFLECTION
                let finalData = synthesized;
                let refinementLoop = 0;
                const MAX_LOOPS = 1;

                while (refinementLoop < MAX_LOOPS) {
                    const repairs = await DiscoveryAgent.critique(finalData, language, apiKeys, (msg) => agent.log('reflection', msg));
                    if (repairs.length === 0) break;

                    agent.log('reflection', `⚠️ Critique found gaps in Draft ${refinementLoop + 1}. Starting Repair Loop...`);
                    // 1. Execute Repairs
                    const repairSources = await (async () => {
                        const repairTasks = repairs.map(r => ({ type: 'query', value: r.value, meta: { goal: r.goal } }));
                        const { BackendFirecrawlService } = await import('../../services/backend/firecrawl.js');
                        const { SourceDocumentRepository } = await import('../../repositories/SourceDocumentRepository.js');

                        const repairResults = await Promise.all(repairTasks.map(async (t: any) => {
                            if (isFirecrawlExhausted) return []; // Skip repair if no credits

                            const searchRes = await BackendFirecrawlService.search(t.value, { limit: 5, apiKey: apiKeys?.firecrawl });
                            const relevantIndices = await DiscoveryAgent.filterResults(searchRes, t.value, apiKeys, 'en', (msg) => agent.log('discovery', msg));
                            const bestCandidates = relevantIndices.map(i => searchRes[i]);

                            const scraped = await Promise.all(bestCandidates.map(async (c: any) => {
                                try {
                                    const cached = await SourceDocumentRepository.findByUrl(c.url);
                                    if (cached && (Date.now() - new Date(cached.crawledAt).getTime() < 86400000)) return { ...c, markdown: cached.rawContent };
                                } catch (e) { }
                                try {
                                    const d = await BackendFirecrawlService.scrape(c.url, { formats: ['markdown'], apiKey: apiKeys?.firecrawl });
                                    return { ...c, markdown: (d as any).markdown };
                                } catch (e: any) {
                                    if (e.statusCode === 402) isFirecrawlExhausted = true;
                                    return null;
                                }
                            }));
                            return scraped.filter(Boolean).map((d: any) => `Source: ${d.url}\nTitle: ${d.title}\nSnippet: ${d.markdown}`);
                        }));
                        return repairResults.flat();
                    })();

                    if (repairSources.length > 0) {
                        agent.log('synthesis', `Incorporating ${repairSources.length} repair sources...`);
                        const repairData = await SynthesisAgent.merge(repairSources, "StrictConsumableData", apiKeys, agentConfig?.prompts?.synthesis, undefined, model, language);
                        const metaMergeSources = [`EXISTING_DRAFT_JSON:\n${JSON.stringify(finalData)}`, `NEW_REPAIR_DATA_JSON:\n${JSON.stringify(repairData)}`];
                        finalData = await SynthesisAgent.merge(metaMergeSources, "StrictConsumableData", apiKeys, agentConfig?.prompts?.synthesis, undefined, model, language);
                    }
                    refinementLoop++;
                }
                return { ...finalData, ...resolvedData };
            }

            // Finalize MPN
            if (!resolvedData.mpn_identity) {
                const inferred = resolvedData.model || resolvedData.short_model || inputRaw;
                resolvedData.mpn_identity = { mpn: inferred, canonical_model_name: inputRaw, variant_flags: { chip: false, counterless: false, high_yield: false, kit: false } };
            }

            return resolvedData;
        });

        // 5. Verification
        await step.run("transition-gate-check", () => agent.transition('gate_check'));
        const verification = await step.run("verify-data", async () => {
            const { QualityGatekeeper } = await import("../../services/agents/QualityGatekeeper.js");
            return await QualityGatekeeper.validate(extractedData as any, language);
        });

        // 6. DB Update
        const result = await step.run("finalize-db", async () => {
            return await agent.complete(verification, extractedData);
        });

        // 7. Graph Population
        await step.run("populate-graph", async () => {
            try {
                const { GraphPopulator } = await import("../../services/ingestion/GraphPopulator.js");
                const graphResult = await GraphPopulator.populateFromResearch(item.id, extractedData as any, jobId);
                agent.log('orchestrator', `📊 Graph populated: ${graphResult.entitiesCreated} entities, ${graphResult.edgesCreated} edges`);
                return graphResult;
            } catch (e: any) {
                console.warn('[GraphPopulator] Error during population:', e);
                agent.log('system', `⚠️ Graph population skipped: ${e.message}`);
                return { entitiesCreated: 0, edgesCreated: 0 };
            }
        });

        return { success: true, ...result };
    }
);
