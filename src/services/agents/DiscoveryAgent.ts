
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
        type?: "query" | "domain_crawl" | "firecrawl_agent";
        target_url?: string;
        schema?: any;
    }>;
}

export interface RetrieverResult {
    url: string;
    title: string;
    markdown: string;
    source_type: 'nix_ru' | 'official' | 'marketplace' | 'other';
    timestamp: string;
}

import { WHITELIST_DOMAINS } from "../../config/domains.js";

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
            - TARGET MARKET: Russia (Primary), Global (Secondary), China (OEM).
            - Use Russian for local retailer availability (nix.ru, dns-shop.ru).
            - Use English for Official Specs and Datasheets (hp.com, canon.com).
            - Use Chinese for OEM/Factory sourcing if DEEP mode (1688.com, alibaba).
            `
            : `
            - TARGET MARKET: Global (Primary), China (OEM).
            - Use English for all standard queries.
            - Use Chinese for OEM/Factory sourcing if DEEP mode.
            `;

        const systemPrompt = promptOverride || `You are the Lead Research Planner for a Printer Consumables Database.
        Your goal is to analyze the user input and construct a precise, HIGH-RECALL search strategy.
        
        Research Modes:
        - Fast: Quick identification. 2-3 queries (EN/RU mixed).
        - Balanced: Verification. 4-6 queries testing Official vs Retailer data.
        - Deep: "Leave No Stone Unturned". 8-12 queries. MUST traverse English (Official), Russian (Local), and Chinese (OEM) sources.

        Current Mode: ${mode.toUpperCase()}
        Target Language: ${language.toUpperCase()}

        Input: "${inputRaw}"
        ${contextInstruction}

        Return a JSON object with:
        - type: "single_sku" | "list" | "unknown"
        - mpn: string
        - canonical_name: string
        - strategies: Array<{
            name: string;
            type: "query" | "domain_crawl" | "firecrawl_agent";
            queries: string[];
            target_domain?: string;
            schema?: any; // JSON Schema for Agent Structured Output
        }>

        CRITICAL SEARCH RULES (99% Recall Protocol):
        1. **Multi-Lingual Triangulation**:
           - ALWAYS generate at least one query in English (e.g. "[Model] specs datasheet").
           - If target is RU, ALWAYS generate Russian commercial queries (e.g. "[Model] купить характеристики").
           - If DEEP mode, ALWAYS generate Chinese OEM queries (e.g. "[Model] 耗材", "[Model] 规格").
        2. **Logistics Mandatory**:
           - Include "weight", "dimensions", "packaging" terms in queries.
        3. **Source Diversity**:
           - Target Official Sites (HP, Canon).
           - Target Marketplaces (Amazon, Wildberries).
        4. **Autonomous Agent (Firecrawl Agent)**:
           - In DEEP mode, use "firecrawl_agent" type for complex navigation tasks.
           - MUST provide a JSON schema for the agent to extract structured data.
           - Example prompt: "Find valid datasheet for [Model] on official site and extract all tables".
        
        Example Deep Strategy:
        [
          { "name": "Official Specs (EN)", "queries": ["Canon C-EXV 42 datasheet pdf"], "type": "query" },
          { 
            "name": "Autonomous Navigation (Strict)", 
            "queries": ["Navigate to Canon support page for C-EXV 42 and extract technical specifications"], 
            "type": "firecrawl_agent",
            "schema": {
                "type": "object",
                "properties": {
                    "yield": { 
                        "type": "object",
                        "properties": {
                            "value": { "type": "number", "description": "Numeric yield" },
                            "unit": { "type": "string", "enum": ["pages", "copies", "ml"] }
                        }
                    },
                    "packaging_from_nix": {
                        "type": "object",
                        "properties": {
                            "weight_g": { "type": "number", "description": "Weight in grams" },
                            "width_mm": { "type": "number" },
                            "height_mm": { "type": "number" },
                            "depth_mm": { "type": "number" }
                        }
                    },
                    "compatible_printers_ru": { 
                        "type": "array", 
                        "items": { "type": "object", "properties": { "model": { "type": "string" } } }
                    },
                    "brand": { "type": "string" },
                    "consumable_type": { "type": "string" }
                }
            }
          }
        ]
        `;

        const modelsToTry = [
            model || "openrouter/auto:free", // Primary - let Auto decide
            "google/gemini-2.0-flash-exp:free", // Secondary 
            "google/gemini-2.0-flash-thinking-exp:free"
        ];

        // Deduplicate
        const uniqueModels = [...new Set(modelsToTry)];

        for (const modelId of uniqueModels) {
            try {
                const response = await BackendLLMService.complete({
                    model: modelId,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: inputRaw }
                    ],
                    jsonSchema: true,
                    maxTokens: 4096, // Cap to fit free tier
                    apiKeys // Pass to service
                });

                const plan = JSON.parse(response || "{}");

                // ---------------------------------------------------------
                // "Smarter" Safeguard: Enforce Language Protocol (User: "ALWAYS")
                // ---------------------------------------------------------
                if (mode === 'deep' && plan.strategies) {
                    const allQueries = plan.strategies.flatMap((s: any) => s.queries || []).join(' ');

                    const hasChinese = /[\u4e00-\u9fa5]/.test(allQueries);
                    const hasRussian = /[а-яА-Я]/.test(allQueries);

                    // Force Chinese OEM Strategy if missing
                    if (!hasChinese) {
                        plan.strategies.push({
                            name: "Enforced OEM Sourcing (Smart)",
                            type: "query",
                            queries: [
                                `${inputRaw} 耗材 (consumables)`,
                                `${inputRaw} 规格 (specs)`,
                                `${inputRaw} original manufacturer`
                            ]
                        });
                    }

                    // Force Russian Retail Strategy if target is RU and missing
                    if (isRu && !hasRussian) {
                        plan.strategies.push({
                            name: "Enforced Local Availability (Smart)",
                            type: "query",
                            queries: [
                                `${inputRaw} купить`,
                                `${inputRaw} характеристики`,
                                `site:nix.ru ${inputRaw}`,
                                `site:dns-shop.ru ${inputRaw}`
                            ]
                        });
                    }
                }

                return plan;

            } catch (error) {
                console.warn(`DiscoveryAgent Plan Failed with ${modelId}, trying next...`, (error as any).message);
            }
        }

        console.error("DiscoveryAgent: All models failed.");
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
