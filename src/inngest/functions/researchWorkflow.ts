
import { inngest } from "../client.js";
import { OrchestratorAgent } from "../../services/agents/OrchestratorAgent.js";
import { DiscoveryAgent } from "../../services/agents/DiscoveryAgent.js";
import { z } from "zod";

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
            // @ts-ignore - Inngest typing quirk
            const { jobId } = event.data;
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
                    if (strategy.type === 'url' && strategy.target_url) {
                        // HYDRA: Direct URL Injection
                        await FrontierService.add(jobId, 'url', strategy.target_url, 100, 0, { strategy: strategy.name });
                    }
                    else if (strategy.type === 'domain_crawl' && strategy.target_domain) {
                        await FrontierService.add(jobId, 'domain_crawl', strategy.target_url || strategy.target_domain, 100, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: (strategy as any).schema });
                    } else if (strategy.type === 'domain_map' && strategy.target_domain) {
                        // NEW: Domain Map Strategy
                        await FrontierService.add(jobId, 'domain_map', strategy.target_domain, 100, 0, { strategy: strategy.name, queries: strategy.queries, schema: (strategy as any).schema });
                    } else {
                        for (const query of strategy.queries) {
                            await FrontierService.add(jobId, (strategy.type as any) || 'query', query, 50, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: (strategy as any).schema });
                        }
                    }
                }
            }

            // GRAPH-LITE FAST PATH (Vertical Search)
            // @ts-ignore - 'evidence' property might be missing on type
            if (plan.evidence) {
                agent.log('discovery', '⚡ Graph-Lite Hit! Skipping web search to prioritize local knowledge.');

                // 1. Create Pseudo-Source
                const sourceDoc = await SourceDocumentRepository.create({
                    jobId,
                    // @ts-ignore
                    url: `graph://${plan.mpn || 'internal'}`,
                    domain: 'graph-lite.internal',
                    // @ts-ignore
                    rawContent: JSON.stringify(plan.evidence),
                    status: 'success',
                    extractedMetadata: { title: "Graph-Lite Entry", type: "graph_lite" }
                });

                // 2. Flatten & Inject Claims
                const flatten = (obj: any, prefix = '') => {
                    let res: any[] = [];
                    for (const [key, val] of Object.entries(obj)) {
                        if (key === '_evidence') continue; // Skip metadata
                        const fieldKey = prefix ? `${prefix}.${key}` : key;
                        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                            res = res.concat(flatten(val, fieldKey));
                        } else {
                            res.push({ field: fieldKey, value: val });
                        }
                    }
                    return res;
                };

                // @ts-ignore
                const flatClaims = flatten(plan.evidence);
                if (flatClaims.length > 0) {
                    await ClaimsRepository.createBatch(flatClaims.map((c: any) => ({
                        itemId: item.id,
                        sourceDocId: sourceDoc.id,
                        field: c.field,
                        value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
                        confidence: 99
                    })));
                }

                // Return synthetic result to satisfy workflow
                return [{
                    // @ts-ignore
                    url: `graph://${plan.mpn}`,
                    title: "Graph-Lite",
                    // @ts-ignore
                    markdown: JSON.stringify(plan.evidence),
                    source_type: 'graph_lite',
                    timestamp: new Date().toISOString()
                }];
            }

            // Loop Config - Increased concurrency for Pipelining
            let defaultBudget = { maxQueries: 10, limitPerQuery: 5, concurrency: 8 }; // UPGRADED to 8
            let MAX_LOOPS = mode === 'deep' ? 15 : 5;

            // ADAPTIVE UPGRADE: Override with Agent's suggested budget
            if (plan.suggestedBudget) {
                agent.log('discovery', `🎯 Adopting Agent's strategic budget: ${plan.suggestedBudget.mode.toUpperCase()} (Concurrency: ${plan.suggestedBudget.concurrency})`);
                defaultBudget.concurrency = plan.suggestedBudget.concurrency;

                // Adjust loops/depth based on agent suggestion
                if (plan.suggestedBudget.mode === 'deep') MAX_LOOPS = 15;
                else if (plan.suggestedBudget.mode === 'fast') MAX_LOOPS = 2; // Very fast
                else MAX_LOOPS = 7; // Balanced+
            }

            const budget = (budgets && budgets[mode]) ? { ...defaultBudget, ...budgets[mode] } : defaultBudget;

            // Total Execution Limit (Safety valve) - Increased for Parallelism
            const CONCURRENCY = budget.concurrency || 5;

            // 1. Frontier Execution (Phase F)
            const allResults: any[] = [];
            const activeAnalyses: Promise<void>[] = []; // Track background analyses

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

                            // VISIBILITY UPGRADE: Log Retry/Pauses
                            searchOptions.onRetry = (attempt: number, error: any, delay: number) => {
                                if (delay > 2000) {
                                    agent.log('system', `⏳ Rate Limit Hit. Pausing research for ${Math.round(delay / 1000)}s...`);
                                }
                            };

                            // FIRESEARCH UPGRADE: Select-then-Scrape Pattern
                            // 1. Fetch Metadata Only (Cheaper)
                            const metadataResults = await BackendFirecrawlService.search(task.value, searchOptions);

                            // 2. SOTA Smart Relevance Filter (AI Judge)
                            let selectedIndices: number[] = [];
                            try {
                                selectedIndices = await DiscoveryAgent.filterResults(metadataResults, task.value, apiKeys, 'en');
                                agent.log('discovery', `🧠 AI Judge selected ${selectedIndices.length}/${metadataResults.length} candidates.`);
                            } catch (e) {
                                selectedIndices = [0, 1, 2].filter(i => i < metadataResults.length);
                            }

                            const candidates = selectedIndices.map(i => metadataResults[i]);

                            if (candidates.length > 0) {
                                for (const candidate of candidates) {
                                    const c = candidate as any; // Cast to bypass union issues
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
                            const isPaymentError = e.statusCode === 402 || e.message?.includes("Payment Required");
                            const isRateLimit = e.statusCode === 429;

                            if (isMissingKey || isAuthError || isPaymentError || isRateLimit || isZeroResults) {
                                agent.log('discovery', `⚠️ Firecrawl unavailable (${isMissingKey ? 'No Key' : isZeroResults ? '0 Results' : e.statusCode || 'Error'}). Switching to Fallback Search.`);
                            } else {
                                console.warn("Firecrawl failed with unexpected error, trying fallback", e);
                            }

                            try {
                                const raw = await FallbackSearchService.search(task.value, apiKeys);
                                // Fallback search usually DOES return content (because it's often wrapper around non-Firecrawl or simple SERP+Scrape).
                                // But if FallbackSearchService only returns snippets, we might be in trouble?
                                // Assumption: FallbackSearchService tries to get content or at least a good snippet.
                                // If it returns full content, we use it. 
                                results = raw.map(r => ({ ...r, source_type: 'fallback' }));
                            } catch (fallbackErr) {
                                console.error("Fallback search also failed", fallbackErr);
                                results = [];
                            }
                        }
                    } else if (task.type === 'domain_crawl') {
                        agent.log('discovery', `Starting Deep Map on ${task.value}...`);
                        try {
                            // FIRESEARCH UPGRADE: Use /map endpoint for high recall
                            const mapResults = await BackendFirecrawlService.map(task.value, {
                                limit: 50,
                                search: plan.canonical_name || undefined, // Optional filter
                                apiKey: apiKeys?.firecrawl
                            });

                            if (mapResults && mapResults.length > 0) {
                                agent.log('discovery', `Mapped ${mapResults.length} pages on ${task.value}`);
                                // We don't have content yet, so we must add them as URL tasks to be scraped.
                                // Unlike Search+Scrape, Map just gives links.
                                // We filter them and add to results so the Frontier logic adds them as 'url' tasks?
                                // No, the current logic adds 'newQueries' to Frontier. 
                                // We should probably manually inject them into Frontier here or return them as "partial" results 
                                // that the Expansion logic picks up? 

                                // Better approach: Add them directly to Frontier here to avoid "Analysis" overhead on just links.
                                const newTasksArg = mapResults.map(l => ({
                                    type: 'url',
                                    value: l.url,
                                    depth: (task.depth || 0) + 1,
                                    meta: { source: 'map', title: l.title }
                                }));

                                // Batch add to Frontier (we need to expose batchAdd or just loop)
                                for (const subTask of newTasksArg) {
                                    await FrontierService.add(jobId, 'url', subTask.value, 40, subTask.depth, subTask.meta);
                                }

                                results = []; // We handled them by scheduling tasks.
                            } else {
                                // Fallback to site: search if map fails or strictly 0
                                const siteQuery = `site:${task.value} ${plan.canonical_name || plan.mpn || "specs"}`;
                                const raw = await BackendFirecrawlService.search(siteQuery, { apiKey: apiKeys?.firecrawl, limit: 10 });
                                results = raw.map(r => ({ ...r, source_type: 'crawl_result' }));
                            }
                        } catch (e: any) {
                            console.warn("Deep Map failed", e);
                            // FALLBACK: Use generic site search
                            const siteQuery = `site:${task.value} ${plan.canonical_name || plan.mpn || "specs"}`;
                            agent.log('discovery', `⚠️ Map failed or No Key. Falling back to site-search: ${siteQuery}`);
                            try {
                                const raw = await FallbackSearchService.search(siteQuery, apiKeys);
                                results = raw.map(r => ({ ...r, source_type: 'fallback_map' }));
                            } catch (fallbackErr) {
                                console.error("Fallback map search failed", fallbackErr);
                            }
                        }
                    } else if (task.type === 'deep_crawl') {
                        agent.log('discovery', `Starting Recursive Crawl on ${task.value}`);
                        try {
                            // Fire-and-forget crawl job
                            const crawlId = await BackendFirecrawlService.crawl(task.value, { limit: 100, maxDepth: 2, apiKey: apiKeys?.firecrawl });

                            // Add "crawl_status" task to Frontier to check later
                            await FrontierService.add(jobId, 'crawl_status', crawlId, 50, task.depth, { originalUrl: task.value });

                            results = []; // No results yet
                        } catch (e: any) {
                            console.warn("Deep Crawl Start Failed", e);
                            // FALLBACK: User wanted deep crawl, but we can't.
                            // We should try to at least "search" the domain extensively?
                            agent.log('discovery', `⚠️ Deep Crawl unavailable. Falling back to targeted site search on ${task.value}`);
                            try {
                                const siteQuery = `site:${task.value} ${plan.canonical_name || "product details"}`;
                                const raw = await FallbackSearchService.search(siteQuery, apiKeys);
                                results = raw.map(r => ({ ...r, source_type: 'fallback_crawl' }));
                            } catch (fallbackErr) {
                                console.error("Fallback deep crawl search failed", fallbackErr);
                            }
                        }
                    } else if (task.type === 'crawl_status') {
                        // Poll for status
                        const crawlId = task.value;
                        const status = await BackendFirecrawlService.checkCrawlStatus(crawlId, apiKeys?.firecrawl);

                        if (status && (status as any).status === 'completed') {
                            agent.log('discovery', `Crawl ${crawlId} Completed! Processing ${(status as any).data?.length || 0} pages.`);
                            const data = (status as any).data || [];
                            results = data.map((d: any) => ({
                                url: d.metadata?.sourceURL || d.url,
                                title: d.metadata?.title || "Crawled Page",
                                markdown: d.markdown || "",
                                source_type: 'deep_crawl'
                            }));
                        } else if (status && (status as any).status === 'failed') {
                            console.warn(`Crawl ${crawlId} Failed.`);
                            results = [];
                        } else {
                            // Still running, re-queue
                            // We can use the Frontier to re-queue. 
                            // CAUTION: Infinite loop if not careful. Add 'checks' count meta?
                            const checks = (task.meta?.checks || 0) + 1;
                            if (checks < 20) { // Give it 20 * loop_time (approx 10 mins?)
                                await FrontierService.add(jobId, 'crawl_status', crawlId, 50, task.depth, { ...task.meta, checks });
                            } else {
                                agent.log('discovery', `Crawl ${crawlId} timed out.`);
                            }
                            results = [];
                        }
                    } else if (task.type === 'url') {
                        try {
                            // Omni-Integration: Request Screenshot for verification
                            const data = await BackendFirecrawlService.scrape(task.value, {
                                formats: ['markdown', 'screenshot'],
                                actions: task.meta?.actions,
                                location: task.meta?.location,
                                waitFor: task.meta?.waitFor,
                                mobile: task.meta?.mobile,
                                maxAge: 86400, // CACHING: 24h
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
                                    screenshot: (data as any).screenshot || null, // Capture screenshot URL
                                    source_type: 'direct_scrape'
                                });
                            }
                        } catch (e: any) {
                            console.warn("URL scrape failed", e);
                            // FALLBACK: If we can't scrape, we might try to ask LLM about it?
                            // This is "Direct URL" task.
                            // If Firecrawl is missing, we can try FallbackSearch with the URL as query.
                            if (e.message?.includes("Missing Firecrawl API Key") || e.statusCode === 402) {
                                try {
                                    agent.log('discovery', `⚠️ Scrape disabled (No Key). Asking Fallback Agent about: ${task.value}`);
                                    const raw = await FallbackSearchService.search(`summarize content of ${task.value}`, apiKeys);
                                    if (raw && raw.length > 0) {
                                        results.push({
                                            url: task.value,
                                            title: raw[0].title || "Fallback Summary",
                                            markdown: raw[0].markdown,
                                            source_type: 'fallback_scrape'
                                        });
                                    }
                                } catch (fbErr) {
                                    console.warn("Fallback scrape failed", fbErr);
                                }
                            }
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
                        } catch (e: any) {
                            console.error("Firecrawl Agent failed", e);
                            // FALLBACK: Just standard fallback search for the prompt
                            try {
                                agent.log('discovery', `⚠️ Firecrawl Agent unavailable. Falling back to standard search.`);
                                const raw = await FallbackSearchService.search(task.value, apiKeys);
                                results = raw.map(r => ({ ...r, source_type: 'fallback_agent' }));
                            } catch (fbErr) {
                                console.warn("Fallback failed", fbErr);
                            }
                        }
                    } else if (task.type === 'domain_map') {
                        agent.log('discovery', `🗺️ Mapping domain: ${task.value}`);
                        try {
                            // Use Firecrawl /map endpoint to get ALL links relevant to the queries
                            const queries = task.meta?.queries || [plan.canonical_name || inputRaw];
                            const searchFilter = queries.join(' ');

                            const mapResults = await BackendFirecrawlService.map(task.value, {
                                limit: 5, // Map top 5 pages (reduced from 20 to save credits)
                                search: searchFilter,
                                apiKey: apiKeys?.firecrawl
                            });

                            if (mapResults && mapResults.length > 0) {
                                agent.log('discovery', `✅ Mapped ${mapResults.length} relevant pages from ${task.value}`);

                                // Add these as "URL" tasks to the frontier.
                                // The Frontier batcher will pick them up and batchScrape them.
                                for (const l of mapResults) {
                                    // Check if URL is valid and not excluded
                                    if (l.url) {
                                        await FrontierService.add(jobId, 'url', l.url, 60, (task.depth || 0) + 1, {
                                            source: 'domain_map',
                                            title: l.title || "Mapped Page",
                                            // Inherit location/actions if needed (less likely for full map)
                                        });
                                    }
                                }
                                results = []; // No direct content results, just scheduled tasks
                            } else {
                                agent.log('discovery', `⚠️ Map found 0 pages for search "${searchFilter}" on ${task.value}. Fallback to Query.`);
                                // Fallback: Add a simple query task for this domain
                                await FrontierService.add(jobId, 'query', `site:${task.value} ${searchFilter}`, 50, task.depth || 0);
                                results = [];
                            }
                        } catch (e) {
                            console.warn("Domain Map failed", e);
                            // FALLBACK: Use generic site search
                            const queries = task.meta?.queries || [plan.canonical_name || inputRaw];
                            const searchFilter = queries.join(' ');
                            agent.log('discovery', `⚠️ Domain Map unavailable. Falling back to site-search: ${searchFilter}`);

                            try {
                                const siteQuery = `site:${task.value} ${searchFilter}`;
                                const raw = await FallbackSearchService.search(siteQuery, apiKeys);
                                results = raw.map(r => ({ ...r, source_type: 'fallback_map' }));
                            } catch (fbErr) { }
                        }
                    } else if (task.type === 'enrichment') {
                        let success = false;
                        try {
                            const { EnrichmentAgent } = await import("../../services/agents/EnrichmentAgent.js");
                            const goal = task.meta?.goal || "Extract all product details";
                            agent.log('discovery', `running enrichment on ${task.value} for: ${goal}`);

                            // 1. Generate Schema
                            const schema = await EnrichmentAgent.generateSchema(goal, task.value, language, model, apiKeys);

                            // 2. Execute Firecrawl Enrich (Extract)
                            // INTELLIGENT UPGRADE: Pass actions/location for interactive sites (nix.ru, etc)
                            const data = await BackendFirecrawlService.enrich(task.value, schema, {
                                apiKey: apiKeys?.firecrawl,
                                actions: task.meta?.actions,
                                location: task.meta?.location,
                                mobile: task.meta?.mobile,
                                waitFor: task.meta?.waitFor
                            });

                            if (data) {
                                results.push({
                                    url: task.value,
                                    title: "Enriched Data",
                                    markdown: JSON.stringify(data), // Save as JSON string for synthesis to parse
                                    source_type: 'agent_result' // Treat as high-quality agent result
                                });
                                success = true;
                            }
                        } catch (e) {
                            console.warn(`Enrichment failed for ${task.value}`, e);
                        }

                        // 3. FALLBACK: If Enrichment failed, Scrape the page so we don't lose the source.
                        // We use the actions/location here to ensure we get the Interactive content.
                        if (!success) {
                            try {
                                agent.log('discovery', `Enrichment failed, falling back to standard scrape for ${task.value}`);
                                const actions = task.meta?.actions;
                                const location = task.meta?.location;

                                const raw = await BackendFirecrawlService.scrape(task.value, {
                                    actions,
                                    location,
                                    apiKey: apiKeys?.firecrawl
                                });

                                if (raw && (raw as any).markdown) {
                                    results.push({
                                        url: task.value,
                                        title: (raw as any).metadata?.title || "Scraped Page (Fallback)",
                                        markdown: (raw as any).markdown,
                                        source_type: 'direct_scrape'
                                    });
                                }
                            } catch (fallbackErr: any) {
                                console.warn(`Fallback scrape also failed for ${task.value}`, fallbackErr);
                                // FINAL FALLBACK: OpenRouter Summary
                                if (fallbackErr.message?.includes("Missing Firecrawl API Key") || fallbackErr.statusCode === 402) {
                                    try {
                                        agent.log('discovery', `⚠️ Enrichment Scrape disabled. Asking Fallback Agent about: ${task.value}`);
                                        const raw = await FallbackSearchService.search(`summarize content of ${task.value}`, apiKeys);
                                        if (raw && raw.length > 0) {
                                            results.push({
                                                url: task.value,
                                                title: raw[0].title || "Fallback Summary",
                                                markdown: raw[0].markdown,
                                                source_type: 'fallback_enrichment'
                                            });
                                        }
                                    } catch (finalErr) { }
                                }
                            }
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
                                extractedMetadata: {
                                    title: r.title,
                                    type: r.source_type,
                                    screenshot: (r as any).screenshot // Save Screenshot URL
                                }
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

                                            // SMART MAPPING: If object has value + evidence + url, map strictly
                                            if (typeof val === 'object' && val !== null && 'value' in val && ('evidence_snippet' in val || 'source_url' in val)) {
                                                const v = val as any;
                                                res.push({
                                                    field: fieldKey.replace('.value', ''), // Strip .value if caught in recursion, but usually this block handles the parent key
                                                    value: v.value,
                                                    confidence: 0.95, // High confidence for Agent extraction
                                                    rawSnippet: v.evidence_snippet || "Agent Extraction",
                                                    sourceUrl: v.source_url || r.url
                                                });
                                            }
                                            // Recursion for arrays or nested objects
                                            else if (typeof val === 'object' && val !== null) {
                                                if (Array.isArray(val)) {
                                                    // For arrays, if items are objects with evidence, we might need complex handling.
                                                    // For now, simple recursion.
                                                    val.forEach((item, idx) => {
                                                        if (typeof item === 'object' && ('evidence_snippet' in item || 'source_url' in item)) {
                                                            // It's a structured item in a list (e.g. faq item)
                                                            // We can't flatten list items easily into single KV pairs without ID. 
                                                            // So we treat the whole item as the value, but try to attach evidence?
                                                            // Actually, for FAQs, we usually store the whole array.
                                                            // Let's just push the whole array as one claim if it's a known complex type?
                                                            // Or recurse with index.
                                                            res = res.concat(flatten(item, `${fieldKey}[${idx}]`));
                                                        } else {
                                                            res = res.concat(flatten(item, `${fieldKey}[${idx}]`));
                                                        }
                                                    });
                                                } else {
                                                    res = res.concat(flatten(val, fieldKey));
                                                }
                                            } else {
                                                // Primitive value
                                                res.push({ field: fieldKey, value: val, confidence: 0.9, rawSnippet: "Agent Extraction", sourceUrl: r.url });
                                            }
                                        }
                                        return res;
                                    };
                                    claims = flatten(parsed);
                                } catch (e) {
                                    // VISION UPGRADE: Pass screenshot if available
                                    claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language, (r as any).screenshot);
                                }
                            } else {
                                // VISION UPGRADE: Pass screenshot if available
                                claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language, (r as any).screenshot);
                            }

                            // 3. Persist Claims (Strict Validation)
                            if (claims && claims.length > 0) {
                                const validClaims = claims
                                    .map(c => {
                                        const result = SafeClaimSchema.safeParse(c);
                                        if (!result.success) {
                                            console.warn(`[Validation] Dropping invalid claim for ${r.url}:`, result.error.format());
                                            return null;
                                        }
                                        return {
                                            itemId: item.id,
                                            sourceDocId: sourceDoc.id,
                                            field: result.data.field,
                                            value: result.data.value,
                                            confidence: Math.round(result.data.confidence)
                                        };
                                    })
                                    .filter(Boolean); // Clean out nulls

                                if (validClaims.length > 0) {
                                    await ClaimsRepository.createBatch(validClaims as any);
                                }
                            }
                        } catch (err) {
                            console.warn(`Failed to process result ${r.url}`, err);
                        }
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

            // Main Sliding Window Execution
            // We maintain a pool of active promises (tasks currently processing).
            // When one finishes, we fetch another.
            const processing = new Set<Promise<any>>();
            let tasksProcessed = 0;
            const MAX_TASKS = MAX_LOOPS * defaultBudget.concurrency; // Approximation of total work

            agent.log('discovery', `🚀 Starting Sliding Window Execution (Target: ${CONCURRENCY} concurrent threads)...`);

            // Helper for processing a BATCH of URL tasks
            const processUrlBatch = async (tasks: any[]) => {
                const urls = tasks.map(t => t.value);
                agent.log('discovery', `📦 Batch Scraping ${urls.length} URLs...`);

                try {
                    const batchResults = await BackendFirecrawlService.batchScrape(urls, {
                        apiKey: apiKeys?.firecrawl,
                        formats: ['markdown', 'screenshot'], // VISION UPGRADE: Enable screenshots for batch
                        // Note: Batch scrape might not return screenshots efficiently or at all depending on options.
                        // Let's stick to markdown for batch efficiency as per plan.
                        maxAge: 86400, // CACHING: 24h
                        timeout: 30000,
                        onRetry: (attempt: number, error: any, delay: number) => {
                            if (delay > 2000) {
                                agent.log('system', `⏳ Batch Rate Limit Hit. Pausing for ${Math.round(delay / 1000)}s...`);
                            }
                        }
                    });

                    // Process results
                    // Firecrawl batchScrape returns array of result objects. 
                    // Order is preserved? SDK says yes usually, or it has metadata.sourceURL

                    for (const task of tasks) {
                        const result = batchResults.find((r: any) => r.metadata?.sourceURL === task.value || r.url === task.value); // Flexible matching

                        if (result) {
                            allResults.push({
                                url: result.metadata?.sourceURL || task.value,
                                title: result.metadata?.title || "Scraped Page",
                                markdown: result.markdown || "",
                                source_type: 'direct_scrape_batch',
                                timestamp: new Date().toISOString()
                            });
                            await FrontierService.complete(task.id, 'completed');
                        } else {
                            // URL failed in batch? 
                            console.warn(`Batch result missing for ${task.value}`);
                            // We could re-queue or mark failed.
                            await FrontierService.complete(task.id, 'failed');
                        }
                    }

                    return tasks.length; // Return count processed
                } catch (e: any) {
                    console.error("Batch Scrape Failed", e);
                    // Fallback: Process individually?
                    // If batch fails completely (e.g. auth), falling back to individual might just fail 5 times.
                    // But if it's a specific URL causing it? 
                    // Firecrawl v2 batch usually handles individual failures internally if ignoreInvalidURLs is true (which we should set?)
                    // Let's mark all as failed for now or retry individually.
                    // Better to re-try individually if meaningful.
                    agent.log('discovery', `⚠️ Batch failed. Retrying ${tasks.length} tasks individually.`);

                    // We can't easily "return" them to the pool without complexity.
                    // Simpler: Just run processTask for each serially or in parallel here.
                    for (const task of tasks) {
                        try {
                            const res = await processTask(task);
                            if (res) {
                                const resultItems = Array.isArray(res) ? res : [res];
                                resultItems.forEach((r: any) => {
                                    if (r) allResults.push({ ...r, timestamp: new Date().toISOString() });
                                });
                            }
                        } catch (err) { /* processTask handles its own errors */ }
                    }
                    return tasks.length;
                }
            };

            while (tasksProcessed < MAX_TASKS) {
                // 1. Fill the pool
                const freeSlots = CONCURRENCY - processing.size;

                if (freeSlots > 0) {
                    // Fetch just enough to fill slots
                    const newTasks = await FrontierService.nextBatch(jobId, freeSlots);

                    if (newTasks.length > 0) {

                        // SEPARATE URL TASKS FOR BATCHING
                        const urlTasks = newTasks.filter(t => t.type === 'url');
                        const otherTasks = newTasks.filter(t => t.type !== 'url');

                        // 1. Process URL Batch
                        if (urlTasks.length > 1) { // Only batch if > 1
                            const p = processUrlBatch(urlTasks).then(() => {
                                processing.delete(p);
                                tasksProcessed += urlTasks.length;
                            });
                            processing.add(p);
                        } else if (urlTasks.length === 1) {
                            // Single URL, process normally
                            otherTasks.push(urlTasks[0]);
                        }

                        // 2. Process Others Individually
                        for (const task of otherTasks) {
                            const p = processTask(task).then(async (result) => {
                                const resultItems = Array.isArray(result) ? result : [result];
                                resultItems.forEach((r: any) => {
                                    if (r) {
                                        allResults.push({
                                            url: r.url,
                                            title: r.title,
                                            markdown: r.markdown,
                                            source_type: r.source_type,
                                            timestamp: new Date().toISOString()
                                        });
                                    }
                                });
                                processing.delete(p);
                                tasksProcessed++;
                            });
                            processing.add(p);
                        }

                    } else {
                        // Queue Empty.
                        if (processing.size === 0) {
                            // Queue Empty AND Pool Empty.
                            // Check Background Analyses?
                            if (activeAnalyses.length > 0) {
                                agent.log('system', `Queue empty. Waiting for ${activeAnalyses.length} background analyses...`);
                                await Promise.all(activeAnalyses);
                                activeAnalyses.length = 0; // Clear
                                // Check if they added stuff
                                const stats = await FrontierService.stats(jobId);
                                if (stats.pending > 0) {
                                    agent.log('system', `Analyses added ${stats.pending} tasks. Resuming...`);
                                    continue; // Loop again to fill spots
                                }
                            }

                            // DEEP MODE: Global Analyst Check (The "Thinking" Step)
                            if (mode === 'deep' && allResults.length > 0) {
                                agent.log('discovery', '🧠 Global Analyst is analyzing progress (Queue Empty)...');
                                const analysis = await DiscoveryAgent.analyzeProgress(jobId, inputRaw, allResults, language, model, apiKeys);
                                if (analysis.new_tasks && analysis.new_tasks.length > 0) {
                                    agent.log('discovery', `🧠 Global Analyst generated ${analysis.new_tasks.length} new tasks.`);
                                    for (const t of analysis.new_tasks) {
                                        await FrontierService.add(jobId, t.type as any, t.value, 40, tasksProcessed + 1, t.meta);
                                    }
                                    continue;
                                }
                            }

                            // Truly Done
                            break;
                        }

                        // Queue Empty, but Pool has workers. Wait for ONE to finish.
                        await Promise.race(processing);
                    }
                } else {
                    // Pool Full. Wait for ONE to finish.
                    await Promise.race(processing);
                }

                // 2. Continuous Background Expansion Check
                // Trigger condition: Every time we have results and aren't swamped
                if (mode !== 'fast' && allResults.length > 0) {
                    // Check if we want to spawn an analysis
                    // Limit active analyses to 1 to avoid spamming the LLM
                    if (activeAnalyses.length < 1) {
                        const BATCH_SIZE = 10;
                        const recentResults = allResults.slice(-BATCH_SIZE);
                        if (recentResults.length > 0) {
                            const analysisPromise = (async () => {
                                const stats = await FrontierService.stats(jobId);
                                if (stats.pending > 20) return;

                                try {
                                    const combinedQueries = await DiscoveryAgent.analyzeForExpansion(inputRaw, recentResults, apiKeys, language);
                                    if (combinedQueries && combinedQueries.length > 0) {
                                        agent.log('discovery', `✨ Background Analysis found ${combinedQueries.length} new signals.`);
                                        for (const q of combinedQueries) {
                                            await FrontierService.add(jobId, 'query', q, 40, tasksProcessed, { source: 'sliding-expansion' });
                                        }
                                    }
                                } catch (e) { }
                            })();
                            activeAnalyses.push(analysisPromise);
                            analysisPromise.then(() => {
                                const idx = activeAnalyses.indexOf(analysisPromise);
                                if (idx > -1) activeAnalyses.splice(idx, 1);
                            });
                        }
                    }
                }
            }

            // Await any remaining
            if (processing.size > 0) {
                agent.log('discovery', `Draining remaining ${processing.size} tasks...`);
                await Promise.all(processing);
            }

            // Logistics Check (Side-quest) - MOVED OUTSIDE LOOP
            if (mode !== 'fast' && plan.canonical_name) {
                const logisticsPrompt = agentConfig?.prompts?.logistics;
                const logistics = await LogisticsAgent.checkNixRu(
                    plan.canonical_name,
                    apiKeys,
                    (msg) => agent.log('logistics', msg),
                    logisticsPrompt,
                    undefined, // modelOverride
                    language   // Pass language context
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
                agent.log('synthesis', 'Trust Engine yielded incomplete data. Activating Swarm Synthesis...');

                // Formulate sources for Swarm
                const combinedSources = searchResults.map((r: any) =>
                    `Source: ${r.url} (${r.source_type})\n Title: ${r.title}\n---\n${r.markdown}`
                );

                const synthesized = await SynthesisAgent.merge(
                    combinedSources,
                    "StrictConsumableData",
                    apiKeys,
                    agentConfig?.prompts?.synthesis,
                    (msg) => agent.log('synthesis', msg), // Pass logger for Swarm progress
                    model,
                    language,
                    inputRaw // Pass original input for grounding
                );

                // DYNAMIC REFLECTION: Check for missing critical fields & REPAIR LOOP
                // We perform 1 refinement loop if needed
                let finalData = synthesized;
                let refinementLoop = 0;
                const MAX_LOOPS = 1;

                while (refinementLoop < MAX_LOOPS) {
                    const repairs = await DiscoveryAgent.critique(finalData, language);

                    if (repairs.length === 0) break;

                    agent.log('reflection', `⚠️ Critique found gaps in Draft ${refinementLoop + 1}. Starting Repair Loop...`);
                    for (const r of repairs) {
                        agent.log('planning', `🔧 Repair Task: ${r.goal} -> Query: "${r.value}"`);
                    }

                    // 1. EXECUTE REPAIRS (Limited Batch)
                    // We treat these as new 'query' tasks
                    const repairTasks = repairs.map(r => ({ type: 'query', value: r.value, meta: { goal: r.goal } }));

                    // We run them directly using processTask (or batch if possible, but keep simple)
                    // For simplicity, we just push them to Frontier nextLoop? No, we want instant feedback.
                    // We'll run them in parallel right here.

                    // We need to use 'processTask' context but we can't easily access 'processUrlBatch' etc from here.
                    // Instead, we will use backend search directly to be fast.
                    const { BackendFirecrawlService } = await import('../../services/backend/firecrawl.js');

                    const repairResults = await Promise.all(repairTasks.map(async (t: any) => {
                        // Search metadata only to save credits, then scrape top 1
                        // Fix: apiKey goes in options, return value IS the array
                        const searchRes = await BackendFirecrawlService.search(t.value, {
                            limit: 2,
                            scrapeOptions: { formats: ['markdown'] },
                            apiKey: apiKeys?.firecrawl
                        });
                        return searchRes.map((d: any) => `Source: ${d.url}\nTitle: ${d.title}\nSnippet: ${d.markdown}`);
                    }));

                    const repairSources = repairResults.flat();

                    if (repairSources.length > 0) {
                        agent.log('synthesis', `Incorporating ${repairSources.length} repair sources...`);

                        // 2. RE-SYNTHESIZE (Merge new sources with PREVIOUS data)
                        // A. Extract from Repair Sources
                        agent.log('synthesis', 'Extracting insights from repair sources...');
                        const repairData = await SynthesisAgent.merge(
                            repairSources,
                            "StrictConsumableData",
                            apiKeys,
                            agentConfig?.prompts?.synthesis,
                            undefined, // No logger to reduce noise
                            model,
                            language
                        );

                        // B. Merge Old + New (Meta-Merge)
                        const metaMergeSources = [
                            `EXISTING_DRAFT_JSON:\n${JSON.stringify(finalData)}`,
                            `NEW_REPAIR_DATA_JSON:\n${JSON.stringify(repairData)}`
                        ];

                        agent.log('synthesis', 'Merging Repair Data with Draft...');
                        finalData = await SynthesisAgent.merge(
                            metaMergeSources,
                            "StrictConsumableData",
                            apiKeys,
                            agentConfig?.prompts?.synthesis,
                            undefined,
                            model,
                            language
                        );
                    }

                    refinementLoop++;
                }

                return { ...finalData, ...resolvedData };
            }

            // FINALIZATION: Ensure 'PENDING' MPN from creating is overwritten
            // If TrustEngine didn't find specific mpn_identity.mpn, we override it with what we have (Model/Short).
            if (!resolvedData.mpn_identity) {
                const inferred = resolvedData.model || resolvedData.short_model || inputRaw;
                resolvedData.mpn_identity = {
                    mpn: inferred, // Fallback to raw input or extracted model
                    canonical_model_name: inputRaw,
                    variant_flags: { chip: false, counterless: false, high_yield: false, kit: false }
                };
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
