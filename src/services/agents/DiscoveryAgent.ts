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

    static async plan(inputRaw: string, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, context?: string): Promise<AgentPlan> { // ADDED context
        onLog?.(`Planning research for "${inputRaw}" in ${mode} mode...`);

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

        const systemPrompt = promptOverride || `You are the Lead Research Planner for a Printer Consumables Database.
        Your goal is to analyze the user input and construct a precise search strategy.
        
        Research Modes:
        - Fast: Focus on quick identification and basic specs. 1-2 generic queries.
        - Balanced: Verify against NIX.ru and official sources. 2-3 queries.
        - Deep: Exhaustive search for difficult items, including forums and cross-ref. 4-5 queries including PDF manuals.

        Current Mode: ${mode.toUpperCase()}

        Input: "${inputRaw}"
        ${contextInstruction}

        Return a JSON object with:
        - type: "single_sku" | "list" | "unknown"
        - mpn: string (if explicitly present)
        - canonical_name: string (normalized model name)
        - strategies: An array of steps. Each step has:
            - name: string (e.g. "Primary Specs", "Logistics Check", "Verification")
            - queries: string[] (The exact Firecrawl queries)
            - target_domain: string (optional, e.g. "nix.ru" for weight checks)
        
        Rules:
        1. ALWAYS include a specific query for "NIX.ru [model] weight" if mode is Balanced or Deep.
        2. If the input is a list, set type to "list" and suggest splitting.
        3. Use Russian queries for logistics (e.g. "вес упаковки").
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
                    queries: [`${inputRaw} specs`, `${inputRaw} cartridge`]
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
            fast: { maxQueries: 2, limitPerQuery: 3 },
            balanced: { maxQueries: 5, limitPerQuery: 5 },
            deep: { maxQueries: 12, limitPerQuery: 10 }
        };

        const budget = budgetOverrides?.[currentMode] || defaultBudgets[currentMode as ResearchMode];
        let queryCount = 0;

        for (const strategy of plan.strategies) {
            for (const query of strategy.queries) {
                if (queryCount >= budget.maxQueries) {
                    // Skipped blocked domain

                    break;
                }
                queryCount++;

                try {
                    onLog?.(`Executing query: "${query}"...`);

                    let searchResults: RetrieverResult[] = [];
                    try {
                        // Primary: Firecrawl
                        const rawResults = await BackendFirecrawlService.search(query, {
                            limit: budget.limitPerQuery,
                            formats: ['markdown'],
                            apiKey: apiKeys?.firecrawl
                        });

                        // Map raw results to RetrieverResult if needed, or assume Firecrawl returns compatible shape
                        // The current BackendFirecrawlService returns `any[]` but usually matches expected shape
                        // We need to map it to ensure consistency
                        searchResults = rawResults.map((item: any) => ({
                            url: item.url,
                            title: item.title || "No Title",
                            markdown: item.markdown || "",
                            source_type: 'other', // Will be refined below
                            timestamp: new Date().toISOString()
                        }));

                    } catch (fcError) {
                        console.warn(`Primary Search Failed for "${query}":`, fcError);
                        onLog?.(`Primary search failed. Switching to Fallback (Perplexity)...`);

                        // Fallback: Perplexity
                        const { FallbackSearchService } = await import("../backend/fallback.js");
                        searchResults = await FallbackSearchService.search(query, apiKeys);
                    }

                    onLog?.(`Found ${searchResults.length} results for "${query}".`);

                    for (const item of searchResults) {
                        if (visitedUrls.has(item.url)) continue;

                        const domain = new URL(item.url).hostname;

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
                        }

                        // If item came from fallback, source_type is 'other' but domain check above might refine it.

                        // --- Source Type allowed check ---
                        if (sourceConfig && sourceConfig.allowedTypes) {
                            // This is imperfect mapping but sufficient for MVP
                            if (sourceType === 'official' && !sourceConfig.allowedTypes.official) continue;
                            if (sourceType === 'marketplace' && !sourceConfig.allowedTypes.marketplaces) continue;
                            // Community/Search mappings would need smarter classifiers, but 'other' falls into here
                            if (sourceType === 'other' && !sourceConfig.allowedTypes.search) continue;
                        }
                        // --------------------------------


                        // Target domain filter
                        if (strategy.target_domain && !domain.includes(strategy.target_domain)) {
                            continue;
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
