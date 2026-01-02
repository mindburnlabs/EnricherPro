
import { inngest } from "../client.js";
import { OrchestratorAgent } from "../../services/agents/OrchestratorAgent.js";

export const researchWorkflow = inngest.createFunction(
    {
        id: "research-workflow",
        concurrency: { limit: 20 },
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
                    if (strategy.type === 'domain_crawl' && strategy.target_domain) {
                        await FrontierService.add(jobId, 'domain_crawl', strategy.target_url || strategy.target_domain, 100, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: strategy.schema });
                    } else if (strategy.type === 'domain_map' && strategy.target_domain) {
                        // NEW: Domain Map Strategy
                        await FrontierService.add(jobId, 'domain_map', strategy.target_domain, 100, 0, { strategy: strategy.name, queries: strategy.queries, schema: strategy.schema });
                    } else {
                        for (const query of strategy.queries) {
                            await FrontierService.add(jobId, (strategy.type as any) || 'query', query, 50, 0, { strategy: strategy.name, target_domain: strategy.target_domain, schema: strategy.schema });
                        }
                    }
                }
            }

            // Loop Config - Reduced concurrency to avoid 429s on free tier
            // Loop Config - Reduced concurrency to avoid 429s on free tier
            // Loop Config - Reduced concurrency to avoid 429s on free tier
            let defaultBudget = { maxQueries: 10, limitPerQuery: 5, concurrency: 5 };
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
            const CONCURRENCY = budget.concurrency || 3;

            // 1. Frontier Execution (Phase F)
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

                            // FIRESEARCH UPGRADE: Request Markdown in Search
                            // This allows us to skip the subsequent 'scrape' step for high-quality results.
                            searchOptions.formats = ['markdown'];

                            const raw = await BackendFirecrawlService.search(task.value, searchOptions);

                            // Map results. If markdown is present, mark as 'distilled_source' or 'direct_scrape'
                            results = raw.map(r => ({
                                ...r,
                                source_type: (r as any).markdown ? 'direct_scrape' : 'web', // Promote to direct_scrape if content exists
                                markdown: (r as any).markdown // Ensure markdown is passed through
                            }));
                        } catch (e: any) {
                            // CRITICAL: Explicit Error Handling for User Visibility
                            const isMissingKey = e.message?.includes("Missing Firecrawl API Key");
                            const isAuthError = e.statusCode === 401 || e.statusCode === 403;
                            const isPaymentError = e.statusCode === 402 || e.message?.includes("Payment Required");
                            const isRateLimit = e.statusCode === 429;

                            // If it's a "Missing Key" or "Auth" error, we AUTOMATICALLY fallback without warning spam.
                            // If it's Payment (402), we also fallback but maybe warn?
                            // Plan: If Firecrawl is down/missing/unpaid, we use OpenRouter.

                            if (isMissingKey || isAuthError || isPaymentError || isRateLimit) {
                                agent.log('discovery', `⚠️ Firecrawl unavailable (${isMissingKey ? 'No Key' : e.statusCode || 'Error'}). Switching to Fallback Search.`);
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
                                apiKey: apiKeys?.firecrawl
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
                            const data = await BackendFirecrawlService.enrich(task.value, schema, { apiKey: apiKeys?.firecrawl });

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
                                    claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language);
                                }
                            } else {
                                claims = await SynthesisAgent.extractClaims(r.markdown || "", r.url, apiKeys, undefined, model, language);
                            }

                            // 3. Persist Claims
                            if (claims && claims.length > 0) {
                                await ClaimsRepository.createBatch(claims.filter(c => c.field).map(c => ({
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

                    // 4. Frontier Expansion - MOVED TO BATCH LEVEL
                    // if (mode !== 'fast' && loops < MAX_LOOPS && results.length > 0) { ... }

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

                // DEEP MODE: Global Analyst Check (The "Thinking" Step)
                if (tasks.length === 0 && mode === 'deep' && loops > 0 && loops < MAX_LOOPS) {
                    agent.log('discovery', '🧠 Global Analyst is analyzing progress...');

                    const analysis = await DiscoveryAgent.analyzeProgress(
                        jobId,
                        inputRaw,
                        allResults,
                        language,
                        model,
                        apiKeys
                    );

                    if (analysis.action === 'stop') {
                        agent.log('discovery', '🧠 Global Analyst decided we have sufficient data.');
                        break;
                    }

                    if (analysis.new_tasks && analysis.new_tasks.length > 0) {
                        agent.log('discovery', `🧠 Global Analyst generated ${analysis.new_tasks.length} new tasks.`);
                        for (const t of analysis.new_tasks) {
                            // If enrichment, we might need to resolve the schema now or later.
                            // The task processor handles "enrichment" type.
                            await FrontierService.add(jobId, t.type as any, t.value, 40, loops + 1, t.meta);
                        }
                        // Continue loop to pick up new tasks
                        continue;
                    }
                }

                if (tasks.length === 0) break;

                loops++;
                agent.log('discovery', `Executing Batch ${loops}: ${tasks.length} tasks in parallel...`);

                // Execute in parallel
                // OPTIMIZATION: Opportunistic Batching for 'url' tasks
                const urlTasks = tasks.filter(t => t.type === 'url');
                const otherTasks = tasks.filter(t => t.type !== 'url');

                // 1. Process Batchable URL Tasks
                if (urlTasks.length > 0) {
                    agent.log('discovery', `⚡ Batching ${urlTasks.length} URL scrapes for efficiency...`);
                    try {
                        const urls = urlTasks.map(t => t.value);
                        const batchResults = await BackendFirecrawlService.batchScrape(urls, {
                            formats: ['markdown'],
                            // Use meta from first task as representative (imperfect but pragmatic for batches)
                            location: (urlTasks[0].meta as any)?.location,
                            apiKey: apiKeys?.firecrawl
                        });

                        // Map back to results
                        batchResults.forEach(r => {
                            if ((r as any).markdown) {
                                allResults.push({
                                    url: (r as any).metadata?.sourceURL || (r as any).url, // Fallback
                                    title: (r as any).metadata?.title || "Batch Scraped Page",
                                    markdown: (r as any).markdown,
                                    source_type: 'direct_scrape',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        });

                        // Mark all as completed
                        await Promise.all(urlTasks.map(t => FrontierService.complete(t.id, 'completed')));

                    } catch (e) {
                        console.error("Batch Scrape Failed, falling back to individual processing", e);
                        // If it failed due to missing key, individual 'processTask' will now handle the fallback!
                        // Fallback: Add them back to 'otherTasks' to be processed individually by processTask
                        otherTasks.push(...urlTasks);
                    }
                }

                // 2. Process Other Tasks (and failed batch tasks) individually
                if (otherTasks.length > 0) {
                    const batchResults = await Promise.all(otherTasks.map(task => processTask(task)));
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


                // 3. BATCH EXPANSION CHECK
                // Analyze all new results from this batch to find new opportunities
                if (mode !== 'fast' && loops < MAX_LOOPS && allResults.length > 0) {
                    const BATCH_SIZE_FOR_ANALYSIS = 10;
                    const recentResults = allResults.slice(-Math.min(allResults.length, BATCH_SIZE_FOR_ANALYSIS));

                    if (recentResults.length > 0) {
                        agent.log('discovery', `🔎 Running Batch Expansion Analysis on ${recentResults.length} recent items...`);
                        try {
                            const combinedQueries = await DiscoveryAgent.analyzeForExpansion(inputRaw, recentResults, apiKeys, language);

                            if (combinedQueries && combinedQueries.length > 0) {
                                agent.log('discovery', `✨ Batch Expansion found ${combinedQueries.length} new signals.`);
                                for (const q of combinedQueries) {
                                    await FrontierService.add(jobId, 'query', q, 40, loops + 1, { source: 'batch-expansion' });
                                }
                            }
                        } catch (e) {
                            console.warn("Batch expansion failed", e);
                        }
                    }
                }
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
