
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

    /**
     * Heuristic Parser to extract "Knowns" from input string.
     * Example: "Картридж HP W1331X С ЧИПОМ 15K" -> { brand: "HP", model: "W1331X", yield: 15000 }
     */
    static parseInput(input: string): { brand?: string, model?: string, yield?: number, type?: string } {
        const result: any = {};

        // Brand Detection (common lists)
        const brands = ['HP', 'Canon', 'Kyocera', 'Brother', 'Xerox', 'Samsung', 'Ricoh', 'Pantum'];
        const brandMatch = brands.find(b => new RegExp(`\\b${b}\\b`, 'i').test(input));
        if (brandMatch) result.brand = brandMatch;

        // Yield Detection (e.g. "15K", "15000")
        const kMatch = input.match(/(\d+)[kК]\b/i);
        if (kMatch) {
            result.yield = parseInt(kMatch[1]) * 1000;
        } else {
            const plainMatch = input.match(/(\d{3,})\s*(pages|стр|копий)/i);
            if (plainMatch) result.yield = parseInt(plainMatch[1]);
        }

        // Model Detection (Simple alphanumeric logic - usually the "weird" distinct word)
        // This is heuristic and can be improved.
        if (result.brand) {
            // Find word after brand, or look for patterns like W1331X, Q2612A
            const words = input.split(' ');
            const potentialModel = words.find(w => /[A-Z]+\d+[A-Z]*/.test(w) && w.length > 3 && !brands.includes(w));
            if (potentialModel) result.model = potentialModel;
        }

        return result;
    }

    static async plan(inputRaw: string, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, context?: string, language: string = 'en', model?: string, sourceConfig?: { official: boolean, marketplace: boolean, community: boolean }): Promise<AgentPlan> {
        onLog?.(`Planning research for "${inputRaw}" in ${mode} mode (${language.toUpperCase()})...`);

        // 1. Pre-process Input
        const knowns = this.parseInput(inputRaw);
        onLog?.(`Parsed Knowns: ${JSON.stringify(knowns)}`);

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

        // Source Constraints
        const sourceRules = sourceConfig ? `
        SOURCE CONSTRAINTS (USER OVERRIDES):
        - Official Sources (hp.com, canon.com, etc): ${sourceConfig.official ? "ALLOWED" : "FORBIDDEN (Do not generate queries for official sites)"}
        - Marketplaces (Amazon, Alibaba, Wildberries): ${sourceConfig.marketplace ? "ALLOWED" : "FORBIDDEN (Do not generate queries for marketplaces)"}
        - Community/Forums (Reddit, FixYourOwnPrinter): ${sourceConfig.community ? "ALLOWED" : "FORBIDDEN (Do not generate queries for forums)"}
        ` : "";

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

        const systemPromptEn = promptOverride || `You are the Lead Research Planner for a Printer Consumables Database.
        Your goal is to analyze the user input and construct a precise, HIGH-RECALL search strategy.
        
        Research Modes:
        - Fast: Quick identification. 2-3 queries.
        - Balanced: Verification. 4-6 queries testing Official vs Retailer data.
        - Deep: "Leave No Stone Unturned". 8-12 queries. MUST traverse English (Official), Russian (Local), and Chinese (OEM) sources.

        Current Mode: ${mode.toUpperCase()}
        Target Language: ${language.toUpperCase()}
        
        ${sourceRules}

        Input: "${inputRaw}"
        Known Metadata: ${JSON.stringify(knowns)}
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

        CRITICAL ENRICHMENT RULES (Russian Market):
        1. **Identity & Aliases**:
           - Search for "Short Name" or "Alias" (e.g. Q2612A -> "12A").
           - Query: "${knowns.model || inputRaw} short name alias", "${knowns.model || inputRaw} сокращенное название".
        2. **RU Compatibility (Strict)**:
           - MUST find printers sold in Russia.
           - Query: "site:nix.ru ${knowns.model || inputRaw} совместимые принтеры", "site:dns-shop.ru ${knowns.model || inputRaw} подходит для".
        3. **FAQ & Pain Points**:
           - Find common problems to generate FAQ.
           - Query: "${knowns.model || inputRaw} problems error defect", "${knowns.model || inputRaw} проблемы форум".
        4. **Related Products**:
           - Find cross-sell items (drums, maintenance kits).
           - Query: "${knowns.model || inputRaw} drum unit", "${knowns.model || inputRaw} фотобарабан".
        
        GENERAL SEARCH RULES:
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
        `;

        const systemPromptRu = `Вы - Ведущий Планировщик Исследований для Базы Данных Расходных Материалов.
        Ваша цель - проанализировать ввод пользователя и создать точную, ИСЧЕРПЫВАЮЩУЮ стратегию поиска.
        
        Режимы Исследования:
        - Fast: Быстрая идентификация. 2-3 запроса.
        - Balanced: Проверка. 4-6 запросов, проверка официальных данных против ритейлеров.
    - Deep: "Не оставить камня на камне". 8-12 запросов. ОБЯЗАТЕЛЬНО искать в Английских (Официальные), Русских (Местные) и Китайских (OEM) источниках.

    ${sourceRules}

    Текущий Режим: ${mode.toUpperCase()}
    Целевой Язык: РУССКИЙ (RU)

        Входные данные: "${inputRaw}"
        Известные Метаданные: ${JSON.stringify(knowns)}
        ${contextInstruction}

        Верните JSON объект со следующей структурой (Ключи JSON должны быть на английском!):
        - type: "single_sku" | "list" | "unknown"
        - mpn: string (Артикул)
        - canonical_name: string (Каноническое имя)
        - strategies: Array<{
            name: string; (Название стратегии на русском)
            type: "query" | "domain_crawl" | "firecrawl_agent";
            queries: string[]; (Массив поисковых запросов)
            target_domain?: string;
            schema?: any; // JSON схема для агента
        }>

        КРИТИЧЕСКИЕ ПРАВИЛА ОБОГАЩЕНИЯ (Российский Рынок):
        1. **Идентификация и Алиасы**:
           - Искать "Сокращенное название" или "Алиас" (например, Q2612A -> "12A").
           - Запрос: "${knowns.model || inputRaw} short name alias", "${knowns.model || inputRaw} сокращенное название".
        2. **Совместимость в РФ (Строго)**:
           - ОБЯЗАТЕЛЬНО найти принтеры, продаваемые в России.
           - Запрос: "site:nix.ru ${knowns.model || inputRaw} совместимые принтеры", "site:dns-shop.ru ${knowns.model || inputRaw} подходит для".
        3. **FAQ и Проблемы**:
           - Найти частые проблемы для генерации FAQ.
           - Запрос: "${knowns.model || inputRaw} проблемы форум", "${knowns.model || inputRaw} common problems".
        4. **Связанные Товары**:
           - Искать кросс-продажи (барабаны, ремкомплекты).
           - Запрос: "${knowns.model || inputRaw} фотобарабан", "${knowns.model || inputRaw} drum unit".

        ОБЩИЕ ПРАВИЛА ПОИСКА:
        1. **Многоязычная Триангуляция**:
           - ВСЕГДА генерировать минимум один запрос на Английском (например, "[Model] specs datasheet").
           - Поскольку цель RU, ВСЕГДА генерировать запросы о покупке/характеристиках на Русском.
           - В режиме DEEP, ВСЕГДА генерировать Китайские OEM запросы (например, "[Model] 耗材").
        2. **Логистика Обязательна**:
           - Включать "вес", "габариты", "упаковка" в запросы.
        3. **Разнообразие Источников**:
           - Официальные сайты (HP, Canon).
           - Маркетплейсы (Wildberries, Ozon, DNS, NIX).
        4. **Автономный Агент (Firecrawl Agent)**:
           - В режиме DEEP использовать тип "firecrawl_agent" для сложной навигации.
           - ОБЯЗАТЕЛЬНО предоставить JSON схему.
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

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

                    // Force FAQ / Problems Strategy if missing (New Requirement)
                    const hasFAQ = /problem|defect|error|проблем|ошиб|форум/i.test(allQueries);
                    if (!hasFAQ) {
                        plan.strategies.push({
                            name: "Enforced FAQ & Troubleshooting",
                            type: "query",
                            queries: [
                                `${inputRaw} common problems`,
                                `${inputRaw} проблемы форум`,
                                `${inputRaw} error codes`
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
    static async analyzeForExpansion(originalQuery: string, searchResults: RetrieverResult[], apiKeys?: Record<string, string>, language: string = 'en'): Promise<string[]> {
        if (searchResults.length === 0) return [];

        const isRu = language === 'ru';
        const systemPromptEn = `You are a Research Expansion Engine.
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

        const systemPromptRu = `Вы - Движок Расширения Поиска.
        Ваша цель - проанализировать сниппеты поиска и найти БОЛЕЕ ТОЧНЫЕ ключевые слова для поиска деталей продукта.
        
        Искать:
        - Альтернативные названия моделей (напр. "Canon C-EXV 42" -> "NPG-57").
        - Артикулы производителя (MPN), если исходный запрос был общим.
        - Специфические коды вендора (напр. "CF287A" -> "87A").
        - Аналоги конкурентов, если уместно.
        
        Верните JSON массив СТРОК (Запросы на РУССКОМ или АНГЛИЙСКОМ, как уместно).
        Пример: ["Canon NPG-57 характеристики", "Canon GPR-43 вес"]
        
        Если новых полезных ключевых слов не найдено, верните пустой массив [].
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

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
