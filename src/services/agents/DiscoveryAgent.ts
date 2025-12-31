
import { BackendLLMService } from "../backend/llm.js";
import { BackendFirecrawlService } from "../backend/firecrawl.js";

export type ResearchMode = 'fast' | 'balanced' | 'deep';

export interface AgentPlan {
    type: "single_sku" | "list" | "unknown";
    mpn: string | null;
    canonical_name: string | null;
    strategies: Array<{
        name: string;
        queries: string[];
        target_domain?: string;
    }>;
}

export interface RetrieverResult {
    url: string;
    title: string;
    markdown: string;
    source_type: 'nix_ru' | 'official' | 'marketplace' | 'other';
    timestamp: string;
}

const WHITELIST_DOMAINS = [
    'nix.ru', 'dns-shop.ru', 'citilink.ru', 'regard.ru',
    'komus.ru', 'rashodnika.net', 'cartridge.ru', 'rm-company.ru',
    'hp.com', 'canon.ru', 'kyoceradocumentsolutions.ru', 'ricoh.ru',
    'brother.ru', 'xerox.ru', 'pantum.ru'
];

export class DiscoveryAgent {

    static async plan(inputRaw: string, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, context?: string, language: string = 'en'): Promise<AgentPlan> {
        onLog?.(`Planning research for "${inputRaw}" in ${mode} mode (${language.toUpperCase()})...`);

        let contextInstruction = "";
        if (context) {
            contextInstruction = `
            PREVIOUS CONTEXT (The user is refining or following up on this result):
            """
            ${context}
            """
            Analyze the input in relation to this context. If the user asks to "correct" or "find more", use the previous data as a baseline.
            `;
        }

        // Dynamic Language Rules
        const isRu = language === 'ru';
        const regionRules = isRu
            ? `
            - PRIMARY MARKET: Russia/CIS.
            - Use Russian keywords for generic terms (e.g., "купить", "характеристики", "совместимость", "вес").
            - Prioritize domains: nix.ru, dns-shop.ru, citilink.ru.
            - Maintain English for Model Names and MPNs (e.g., "Canon C-EXV 42").
            `
            : `
            - PRIMARY MARKET: Global/US/EU.
            - Use English keywords.
            - Prioritize domains: hp.com, canon.com, amazon.com, staples.com.
            `;

        const systemPrompt = promptOverride || `You are the Lead Research Planner for a Printer Consumables Database.
        Your goal is to analyze the user input and construct a precise search strategy.
        
        Research Modes:
        - Fast: Focus on quick identification and basic specs. 1-2 generic queries.
        - Balanced: Verify against ${isRu ? "NIX.ru and local retailers" : "Official Sources and major retailers"}. 3-4 queries.
        - Deep: Exhaustive search. Include Chinese marketplaces (Alibaba/Taobao) for OEM parts, and Legacy Forums (FixYourOwnPrinter) for obscure specs. 5-7 queries.

        Current Mode: ${mode.toUpperCase()}
        Target Language: ${language.toUpperCase()}

        Input: "${inputRaw}"
        ${contextInstruction}

        Return a JSON object with:
        - type: "single_sku" | "list" | "unknown"
        - mpn: string (if explicitly present)
        - canonical_name: string (normalized model name)
        - strategies: An array of steps. Each step has:
            - name: string (e.g. "Primary Specs", "Logistics Check", "Chinese Suppliers", "Forum Deep Dive")
            - queries: string[] (The exact Firecrawl queries)
            - target_domain: string (optional, e.g. "nix.ru" for weight checks, "alibaba.com" for sourcing)
        
        Rules:
        ${regionRules}
        1. ALWAYS include a specific logistics query (e.g. "weight", "dimensions", "вес").
        2. If the input is a list, set type to "list" and suggest splitting.
        3. In DEEP mode, strictly include: "site:alibaba.com [model] specs" and "site:printerknowledge.com [model]".
        `;

        try {
            const response = await BackendLLMService.complete({
                model: "google/gemini-2.0-flash-001",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: inputRaw }
                ],
                jsonSchema: true,
                apiKeys // Pass to service
            });

            return JSON.parse(response || "{}");
        } catch (error) {
            console.error("DiscoveryAgent Plan Failed:", error);
            // Fallback plan
            return {
                type: "single_sku",
                mpn: null,
                canonical_name: inputRaw,
                strategies: [{
                    name: "Fallback Search",
                    queries: [`${inputRaw} specs`, `${inputRaw} cartridge ${isRu ? 'купить' : 'buy'}`]
                }]
            };
        }
    }

    static async execute(plan: AgentPlan, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, budgetOverrides?: Record<string, { maxQueries: number, limitPerQuery: number }>, onLog?: (msg: string) => void, sourceConfig?: any): Promise<RetrieverResult[]> {
        const allResults: RetrieverResult[] = [];
        const visitedUrls = new Set<string>();

        const validModes = ['fast', 'balanced', 'deep'];
        const currentMode = validModes.includes(mode) ? mode : 'balanced';

        const defaultBudgets = {
            fast: { maxQueries: 3, limitPerQuery: 3 },
            balanced: { maxQueries: 6, limitPerQuery: 5 },
            deep: { maxQueries: 15, limitPerQuery: 8 }
        };

        const budget = budgetOverrides?.[currentMode] || defaultBudgets[currentMode as ResearchMode];
        let queryCount = 0;

        // Dynamic Loading of Fallback Service
        const { FallbackSearchService } = await import("../backend/fallback.js");

        for (const strategy of plan.strategies) {
            for (const query of strategy.queries) {
                if (queryCount >= budget.maxQueries) {
                    onLog?.(`Budget limit reached (${budget.maxQueries}). Stopping.`);
                    break;
                }
                queryCount++;

                try {
                    onLog?.(`Executing query: "${query}"...`);

                    let searchResults: RetrieverResult[] = [];
                    let usedFallback = false;

                    try {
                        // PRIMARY: Firecrawl
                        // We set a strict timeout or error handler here
                        const rawResults = await BackendFirecrawlService.search(query, {
                            limit: budget.limitPerQuery,
                            formats: ['markdown'],
                            apiKey: apiKeys?.firecrawl
                        });

                        // Map raw results
                        searchResults = rawResults.map((item: any) => ({
                            url: item.url,
                            title: item.title || "No Title",
                            markdown: item.markdown || "",
                            source_type: 'other', // Will be refined below
                            timestamp: new Date().toISOString()
                        }));

                        // SMART FAILOVER: If results are too few or empty, try Fallback
                        if (searchResults.length < 1) { // Extremely loose check, even 1 result is better than 0
                            throw new Error("Firecrawl returned 0 results");
                        }

                    } catch (fcError) {
                        console.warn(`Primary Search Failed/Low-Yield for "${query}":`, fcError);
                        onLog?.(`Primary search yielded low results. Switching to active Fallback (Perplexity/Sonar)...`);

                        usedFallback = true;
                        // FAILOVER: Perplexity
                        searchResults = await FallbackSearchService.search(query, apiKeys);
                    }

                    // Check again if we still have 0 results after fallback
                    if (searchResults.length === 0) {
                        onLog?.(`No results found even after fallback for "${query}".`);
                        continue;
                    }

                    onLog?.(`Found ${searchResults.length} results for "${query}" (Source: ${usedFallback ? 'Fallback AI' : 'Web Scraper'}).`);

                    for (const item of searchResults) {
                        if (visitedUrls.has(item.url)) continue;

                        // Careful with Perplexity URLs (sometimes they might be just 'perplexity.ai' if not parsed well, but Fallback service tries to be real)
                        let domain = "";
                        try {
                            domain = new URL(item.url).hostname;
                        } catch (e) {
                            domain = "unknown";
                        }

                        // --- Source Management Filtering ---
                        if (sourceConfig) {
                            // 1. Blocked Domains
                            if (sourceConfig.blockedDomains && sourceConfig.blockedDomains.some((d: string) => domain.includes(d))) {
                                console.log(`[Discovery] Skipped blocked domain: ${domain}`);
                                continue;
                            }
                        }
                        // -----------------------------------

                        let sourceType: RetrieverResult['source_type'] = 'other';
                        if (domain.includes('nix.ru')) sourceType = 'nix_ru';
                        else if (WHITELIST_DOMAINS.some(d => domain.includes(d))) {
                            if (domain.includes('hp.com') || domain.includes('canon') || domain.includes('brother')) sourceType = 'official';
                            else sourceType = 'marketplace';
                        } else if (domain.includes('alibaba') || domain.includes('taobao') || domain.includes('aliexpress')) {
                            sourceType = 'marketplace';
                        }

                        // --- Source Type allowed check ---
                        if (sourceConfig && sourceConfig.allowedTypes) {
                            if (sourceType === 'official' && !sourceConfig.allowedTypes.official) continue;
                            if (sourceType === 'marketplace' && !sourceConfig.allowedTypes.marketplaces) continue;
                            if (sourceType === 'other' && !sourceConfig.allowedTypes.search) continue;
                        }
                        // --------------------------------

                        // Target domain filter (loose check)
                        if (strategy.target_domain && !usedFallback) { // If fallback used, we accept anything
                            if (!domain.includes(strategy.target_domain)) continue;
                        }

                        visitedUrls.add(item.url);
                        allResults.push({
                            url: item.url,
                            title: item.title,
                            markdown: item.markdown,
                            source_type: sourceType,
                            timestamp: item.timestamp
                        });
                    }
                } catch (e) {
                    console.error(`Search failed for query "${query}":`, e);
                }
            }
        }
        return allResults;
    }
}
