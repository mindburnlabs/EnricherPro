
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
        type?: "query" | "domain_crawl";
        target_url?: string;
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

    static async plan(inputRaw: string, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, context?: string, language: string = 'en', model?: string): Promise<AgentPlan> {
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
            - type: "query" | "domain_crawl" (Default is "query". Use "domain_crawl" for deep site enumeration)
            - queries: string[] (The exact Firecrawl queries if type is "query")
            - target_domain: string (optional, e.g. "nix.ru")
            - target_url: string (optional, ONLY if type is "domain_crawl", e.g. "https://nix.ru/comp/...")
        
        Rules:
        ${regionRules}
        1. ALWAYS include a specific logistics query (e.g. "weight", "dimensions", "вес").
        2. If the input is a list, set type to "list" and suggest splitting.
        3. In DEEP mode, you MUST include a 'domain_crawl' strategy for high-value targets if identified (e.g. "nix.ru", "hp.com").
        
        Example Strategy Item:
        {
            "name": "NIX.ru Deep Scan",
            "queries": [], 
            "target_domain": "nix.ru",
            "type": "domain_crawl", 
            "target_url": "https://nix.ru/..." 
        }
        `;

        try {
            const response = await BackendLLMService.complete({
                model: model || "google/gemini-2.0-flash-lite-preview-02-05:free",
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

    /**
     * Analyzes search results to find new keyword expansion opportunities.
     * Uses Fast/Cheap model to keep costs low.
     */
    static async analyzeForExpansion(originalQuery: string, searchResults: RetrieverResult[], apiKeys?: Record<string, string>): Promise<string[]> {
        if (searchResults.length === 0) return [];

        const systemPrompt = `You are a Research Expansion Engine.
        Your goal is to look at the search snippets and find BETTER or MORE SPECIFIC keywords to find product details.
        
        Look for:
        - Alternative Model Names (e.g. "Canon C-EXV 42" -> "NPG-57", "GPR-43")
        - OEM Part Numbers (MPNs) if the original query was generic.
        - Specific Vendor Codes (e.g. "CF287A" -> "87A").
        - Competitor equivalents if relevant.
        
        Return a JSON array of STRINGS only.
        Example: ["Canon NPG-57 specs", "Canon GPR-43 weight"]
        
        If no new useful keywords found, return empty array [].
        `;

        const context = searchResults.slice(0, 3).map(r =>
            `Title: ${r.title}\nSnippet: ${r.markdown.substring(0, 300)}`
        ).join("\n---\n");

        try {
            const { ModelProfile } = await import("../../config/models.js");

            const response = await BackendLLMService.complete({
                profile: ModelProfile.FAST_CHEAP,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Original Query: "${originalQuery}"\n\nSearch Results:\n${context}` }
                ],
                jsonSchema: true,
                apiKeys
            });

            const parsed = JSON.parse(response || "[]");
            return Array.isArray(parsed) ? parsed : (parsed.queries || []);
        } catch (e) {
            console.warn("Expansion analysis failed", e);
            return [];
        }
    }

    // Legacy execute kept for compatibility if used elsewhere, but workflow manages loop.
    static async execute(plan: AgentPlan, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, budgetOverrides?: Record<string, { maxQueries: number, limitPerQuery: number }>, onLog?: (msg: string) => void, sourceConfig?: any): Promise<RetrieverResult[]> {
        // Simple shim for compatibility - focused on queries only
        return [];
    }
}
