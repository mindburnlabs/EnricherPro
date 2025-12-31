
import { BackendLLMService } from "../backend/llm";
import { BackendFirecrawlService } from "../backend/firecrawl";

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

    static async plan(inputRaw: string, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>): Promise<AgentPlan> {
        const systemPrompt = `You are the Lead Research Planner for a Printer Consumables Database.
        Your goal is to analyze the user input and construct a precise search strategy.
        
        Research Modes:
        - Fast: Focus on quick identification and basic specs. 1-2 generic queries.
        - Balanced: Verify against NIX.ru and official sources. 2-3 queries.
        - Deep: Exhaustive search for difficult items, including forums and cross-ref. 4-5 queries including PDF manuals.

        Current Mode: ${mode.toUpperCase()}

        Input: "${inputRaw}"

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

    static async execute(plan: AgentPlan, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>): Promise<RetrieverResult[]> {
        const allResults: RetrieverResult[] = [];
        const visitedUrls = new Set<string>();

        // Mode-Based Budgets (Inferred from plan doesn't work well if we don't know mode here, 
        // but wait, execute() doesn't take mode currently. We should pass it or infer.
        // Let's rely on hard limits for now to prevent runaway costs, but ideally pass mode.)
        // Actually, let's assume 'balanced' defaults if we can't tell, but better to update signature?
        // Creating a new signature changes standard interface... let's check callers.
        // Callers: researchWorkflow.ts calls execute(plan, apiKeys).
        // Let's update signature to execute(plan, mode, apiKeys).

        // For now, I'll implement a robust default that auto-throttles. 
        // But the prompt demanded mode budgets. I'll update signature in next step if checking.
        // Actually, let's look at the plan object. It doesn't have mode.
        // I will adhere to "Fast/Balanced/Deep" limits by checking the number of queries in the plan 
        // AND ensuring we don't exceed a global safety cap (e.g. 10 queries).

        const validModes = ['fast', 'balanced', 'deep'];
        const currentMode = validModes.includes(mode) ? mode : 'balanced';

        const BUDGETS = {
            fast: { maxQueries: 2, limitPerQuery: 3 },
            balanced: { maxQueries: 5, limitPerQuery: 5 },
            deep: { maxQueries: 12, limitPerQuery: 10 }
        };

        const budget = BUDGETS[currentMode as ResearchMode];
        let queryCount = 0;

        for (const strategy of plan.strategies) {
            for (const query of strategy.queries) {
                if (queryCount >= budget.maxQueries) {
                    console.log(`[Discovery] Mode '${currentMode}' budget reached (${queryCount} queries).`);
                    break;
                }
                queryCount++;

                try {
                    const searchResults = await BackendFirecrawlService.search(query, {
                        limit: budget.limitPerQuery,
                        formats: ['markdown'],
                        apiKey: apiKeys?.firecrawl
                    });

                    for (const item of searchResults) {
                        if (visitedUrls.has(item.url)) continue;

                        const domain = new URL(item.url).hostname;

                        let sourceType: RetrieverResult['source_type'] = 'other';
                        if (domain.includes('nix.ru')) sourceType = 'nix_ru';
                        else if (WHITELIST_DOMAINS.some(d => domain.includes(d))) {
                            if (domain.includes('hp.com') || domain.includes('canon') || domain.includes('brother')) sourceType = 'official';
                            else sourceType = 'marketplace';
                        }

                        // Target domain filter
                        if (strategy.target_domain && !domain.includes(strategy.target_domain)) {
                            continue;
                        }

                        visitedUrls.add(item.url);
                        allResults.push({
                            url: item.url,
                            title: item.title || "No Title",
                            markdown: item.markdown || "",
                            source_type: sourceType,
                            timestamp: new Date().toISOString()
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
