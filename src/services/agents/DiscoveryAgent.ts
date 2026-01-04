
import { BackendLLMService, RoutingStrategy } from "../backend/llm.js";
import { GraphService } from "../backend/GraphService.js";

import { safeJsonParse } from "../../lib/json.js";
import { ComplexityAnalysisSchema, AgentPlanSchema, ProgressAnalysisSchema, ExpansionSchema } from "../../schemas/agent_schemas.js";

export type ResearchMode = 'fast' | 'balanced' | 'deep';

export interface AgentPlan {
    type: "single_sku" | "list" | "unknown";
    mpn: string | null;
    canonical_name: string | null;
    strategies: Array<{
        name: string;
        queries: string[];
        target_domain?: string;
        type?: "query" | "domain_crawl" | "firecrawl_agent" | "deep_crawl" | "domain_map";
        target_url?: string;
        schema?: any;
        actions?: any[];
        location?: { country?: string; languages?: string[] };
    }>;
    suggestedBudget?: {
        mode: ResearchMode;
        concurrency: number;
        depth: number;
    };
    evidence?: any;
    /** SOTA 2026: Chain-of-Thought reasoning trace for transparency */
    _reasoning?: {
        product_identification: string;
        information_gaps: string;
        source_strategy: string;
        risk_assessment: string;
    };
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

    static async analyzeRequestComplexity(input: string, apiKeys?: Record<string, string>, model: string = "openrouter/auto", onLog?: (msg: string) => void): Promise<{ mode: ResearchMode, reason: string }> {
        try {
            const systemPrompt = `You are a Research Strategist. 
            Analyze the user's request complexity to determine the optimal research mode.
            
            Modes:
            - FAST: Simple fact lookup, single model ID, specific part number (e.g. "HP 12A weight", "Q2612A specs").
            - BALANCED: Comparisons, lists of items, generic terms (e.g. "Canon A3 printers", "HP substitutes").
            - DEEP: Obscure parts, legacy items, complex compatibility, "find all" requests, or detailed technical analysis.

            Return JSON: { "mode": "fast" | "balanced" | "deep", "reason": "..." }
            `;

            const { ModelProfile } = await import("../../config/models.js");
            const response = await BackendLLMService.complete({
                model: model, // Use specific model or fall back to profile if needed
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: input }
                ],
                jsonSchema: ComplexityAnalysisSchema,
                routingStrategy: RoutingStrategy.FAST,
                apiKeys,
                // Pass logging callback if available
                onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined
            });

            const parsed = safeJsonParse(response || "{}");
            return {
                mode: (parsed.mode as ResearchMode) || 'balanced',
                reason: parsed.reason || "Default classification"
            };

        } catch (e) {
            console.warn("Complexity analysis failed, defaulting to balanced", e);
            return { mode: 'balanced', reason: "Analysis failed" };
        }
    }

    static async plan(inputRaw: string, mode: ResearchMode = 'balanced', apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, context?: string, language: string = 'en', model?: string, sourceConfig?: { official: boolean, marketplace: boolean, community: boolean, specificOfficial?: string[], specificMarketplace?: string[], specificCommunity?: string[], sourceOrder?: ('official' | 'marketplace' | 'community')[] }, useFlashPlanner: boolean = true): Promise<AgentPlan> {

        // 0. Auto-Detect Mode (Adaptive Strategy)
        // If mode is 'balanced' (default), we check if we should upgrade/downgrade based on complexity.
        // We do not override 'deep' or 'fast' if explicitly requested (assuming strict user intent),
        // UNLESS the prompt explicitly asks for "smart" behavior which we are baking in.
        // For now, let's log the suggestion and optionally upgrade 'balanced' -> 'deep' if needed.

        let effectiveMode = mode;
        let suggestion = null;

        if (mode === 'balanced') {
            // Suggestion: Update analyzeRequestComplexity to accept onLog?
            // For now, pass undefined or update signature. Let's update signature in next step if checking fails.
            // Actually, I can't update analyzeRequestComplexity call here because I haven't updated its signature yet.
            // I will update plan first to pass onLog to ITS main LLM call.
            suggestion = await this.analyzeRequestComplexity(inputRaw, apiKeys, "openrouter/auto", onLog);
            onLog?.(`🧠 Adaptive Strategy: Analyzed request as '${suggestion.mode}' (${suggestion.reason})`);
            if (suggestion.mode === 'deep') {
                effectiveMode = 'deep';
                onLog?.(`🚀 Upgrading mode to DEEP based on complexity.`);
            } else if (suggestion.mode === 'fast') {
                effectiveMode = 'fast';
                onLog?.(`⚡ Optimizing mode to FAST for simple query.`);
            }
        }

        onLog?.(`Planning research for "${inputRaw}" in ${effectiveMode} mode (${language.toUpperCase()})...`);

        // 1. Pre-process Input
        // ---------------------------------------------------------
        const knowns: any = this.parseInput(inputRaw);

        try {
            const graphHit = await GraphService.resolveIdentity(inputRaw);
            if (graphHit) {
                onLog?.(`🔥 Graph Hit (${graphHit.confidence}%): Resolved "${inputRaw}" -> "${graphHit.mpn}"`);
                // Inject the canonical MPN into 'knowns' to guide the Planner
                knowns.mpn = graphHit.mpn;
                knowns.canonical_name = graphHit.mpn;
                knowns.is_graph_verified = true;
            } else {
                onLog?.(`Network miss for "${inputRaw}". Proceeding to web search.`);
            }
        } catch (e) {
            // Ignore graph errors, fail open to web
            console.warn("Graph lookup failed", e);
        }
        // ---------------------------------------------------------

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
        const formatSourceRule = (name: string, allowed: boolean, specifics?: string[], forbiddenMsg: string = "FORBIDDEN") => {
            if (!allowed) return `- ${name}: ${forbiddenMsg}`;
            if (specifics && specifics.length > 0) return `- ${name}: ALLOWED (STRICTLY FOCUS ON: ${specifics.join(', ')})`;
            return `- ${name}: ALLOWED`;
        };

        const sourceRules = sourceConfig ? `
        SOURCE CONSTRAINTS (USER OVERRIDES):
        ${formatSourceRule("Official Sources (hp.com, canon.com, etc)", sourceConfig.official, sourceConfig.specificOfficial, "FORBIDDEN (Do not generate queries for official sites)")}
        ${formatSourceRule("Marketplaces (Amazon, Alibaba, Wildberries)", sourceConfig.marketplace, sourceConfig.specificMarketplace, "FORBIDDEN (Do not generate queries for marketplaces)")}
        ${formatSourceRule("Community/Forums (Reddit, FixYourOwnPrinter)", sourceConfig.community, sourceConfig.specificCommunity, "FORBIDDEN (Do not generate queries for forums)")}
        
        SOURCE PRIORITY: ${sourceConfig.sourceOrder ? sourceConfig.sourceOrder.join(' > ').toUpperCase() : 'DEFAULT'}
        (Strictly prioritize sources in this order. If the first priority is applicable, allocate 70% of query bandwidth to it.)
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
        
        Current Mode: ${effectiveMode.toUpperCase()}
        Target Language: ${language.toUpperCase()}
        
        ${sourceRules}

        Input: "${inputRaw}"
        Known Metadata: ${JSON.stringify(knowns)}
        ${contextInstruction}

        ═══════════════════════════════════════════════════════════════════════════════
        CHAIN-OF-THOUGHT REASONING PROTOCOL (SOTA 2026)
        ═══════════════════════════════════════════════════════════════════════════════
        Before generating your plan, you MUST explicitly reason through 4 dimensions:
        
        1. PRODUCT IDENTIFICATION (What is this?)
           - Is this a specific SKU (CF217A) or generic term ("HP toner")?
           - Confidence level in identified Brand/MPN/Type?
           - Are there known aliases or regional variants?
        
        2. INFORMATION GAPS (What's missing?)
           - Which required fields are definitely unknown? (MPN, Yield, Weight, Printers)
           - What data is uncertain vs confirmed from input?
           - What's the minimum viable data set for this product?
        
        3. SOURCE STRATEGY (Where to find each gap?)
           - Official site likely to have: specs, yield, images
           - Retailers (nix.ru) likely to have: price, availability, weight, dimensions
           - Forums/Community: problems, error codes, compatibility issues
           - OEM/Chinese sources: original manufacturer data, factory specs
        
        4. RISK ASSESSMENT (What could go wrong?)
           - Ambiguous SKU (model appears in multiple product lines)?
           - Regional variants (US vs RU versions differ)?
           - Data freshness concerns (old product, discontinued)?
           - False positives (similar model names, compatible vs original)?
        
        Include your reasoning in the output:
        "_reasoning": {
            "product_identification": "[Your analysis of the product identity]",
            "information_gaps": "[What's missing and why it matters]",
            "source_strategy": "[Which sources will fill which gaps]",
            "risk_assessment": "[Potential issues and mitigations]"
        }
        ═══════════════════════════════════════════════════════════════════════════════

        Return a JSON object with:
        - type: "single_sku" | "list" | "unknown"
        - mpn: string
        - canonical_name: string
        - _reasoning: { product_identification, information_gaps, source_strategy, risk_assessment }
        - strategies: Array<{
            name: string;
            type: "query" | "domain_crawl" | "firecrawl_agent" | "deep_crawl" | "domain_map";
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
        3. **FAQ & Pain Points (AGENT TASK)**:
           - Use "firecrawl_agent" to find common problems and generate FAQ.
           - Strategy: { type: "firecrawl_agent", queries: ["Find common problems and error codes for ${knowns.model || inputRaw}"], schema: { problems: [{ issue: string, solution: string }] } }
        4. **Official Specs (DEEP CRAWL - SCOPED)**:
           - In DEEP mode, find the *specific* product page or support section to crawl. DO NOT crawl "hp.com" root.
           - Strategy: { type: "query", queries: ["site:hp.com ${knowns.model || inputRaw} support", "site:canon.com ${knowns.model || inputRaw} specifications"] }
           - OR if deeply confident: { type: "deep_crawl", target_domain: "hp.com/support", queries: [] }

        5. **Interactive Enrichment (Interactions)**:
           - If data is hidden behind tabs (e.g. "Specs", "Details") or requires specific location.
           - Strategy: { 
               type: "url", 
               target_url: "https://example.com/product",
               meta: {
                   actions: [{ type: "click", selector: "#specs-tab" }, { type: "wait", milliseconds: 1000 }],
                   location: { country: "US" }
               } 
             }

        6. **Related Products**:
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
        5. **Map & Batch (High-Volume Discovery)**:
            - If the target is a known list page or category (e.g. "hp.com/cartridges"), use "domain_map" to find all relevant product sub-pages.
            - Strategy: { type: "domain_map", target_domain: "https://www.hp.com/us-en/shop/sitesearch", queries: ["${knowns.model || inputRaw}"] }
        `;

        const systemPromptRu = `Вы - Ведущий Планировщик Исследований для Базы Данных Расходных Материалов.
        Ваша цель - проанализировать ввод пользователя и создать точную, ИСЧЕРПЫВАЮЩУЮ стратегию поиска.
        
        Режимы Исследования:
        - Fast: Быстрая идентификация. 2-3 запроса.
        - Balanced: Проверка. 4-6 запросов, проверка официальных данных против ритейлеров.
        - Deep: "Не оставить камня на камне". 8-12 запросов. ОБЯЗАТЕЛЬНО искать в Английских (Официальные), Русских (Местные) и Китайских (OEM) источниках.

        ${sourceRules}

        Текущий Режим: ${effectiveMode.toUpperCase()}
        Целевой Язык: РУССКИЙ (RU)

        Входные данные: "${inputRaw}"
        Известные Метаданные: ${JSON.stringify(knowns)}
        ${contextInstruction}

        ═══════════════════════════════════════════════════════════════════════════════
        ПРОТОКОЛ ПОШАГОВОГО РАССУЖДЕНИЯ (SOTA 2026)
        ═══════════════════════════════════════════════════════════════════════════════
        Перед генерацией плана вы ДОЛЖНЫ явно обосновать по 4 направлениям:
        
        1. ИДЕНТИФИКАЦИЯ ПРОДУКТА (Что это?)
           - Это конкретный артикул (CF217A) или общее понятие ("тонер HP")?
           - Уровень уверенности в Бренде/Артикуле/Типе?
           - Есть ли известные алиасы или региональные варианты?
        
        2. ИНФОРМАЦИОННЫЕ ПРОБЕЛЫ (Чего не хватает?)
           - Какие обязательные поля точно неизвестны? (MPN, Ресурс, Вес, Принтеры)
           - Какие данные неопределённые vs подтверждённые?
           - Какой минимальный набор данных для этого продукта?
        
        3. СТРАТЕГИЯ ИСТОЧНИКОВ (Где найти каждый пробел?)
           - Официальный сайт: спецификации, ресурс, изображения
           - Ритейлеры (nix.ru): цена, наличие, вес, габариты
           - Форумы/Сообщества: проблемы, коды ошибок, совместимость
           - OEM/Китайские источники: данные производителя, заводские спеки
        
        4. ОЦЕНКА РИСКОВ (Что может пойти не так?)
           - Неоднозначный артикул (модель в нескольких линейках)?
           - Региональные варианты (US vs RU версии отличаются)?
           - Актуальность данных (старый продукт, снят с производства)?
           - Ложные срабатывания (похожие названия, совместимый vs оригинал)?
        
        Включите ваше обоснование в вывод:
        "_reasoning": {
            "product_identification": "[Ваш анализ идентификации продукта]",
            "information_gaps": "[Что отсутствует и почему это важно]",
            "source_strategy": "[Какие источники заполнят какие пробелы]",
            "risk_assessment": "[Потенциальные проблемы и их смягчение]"
        }
        ═══════════════════════════════════════════════════════════════════════════════

        Верните JSON объект со следующей структурой (Ключи JSON должны быть на английском!):
        - type: "single_sku" | "list" | "unknown"
        - mpn: string (Артикул)
        - canonical_name: string (Каноническое имя)
        - _reasoning: { product_identification, information_gaps, source_strategy, risk_assessment }
        - strategies: Array<{
            name: string; (Название стратегии на русском)
            type: "query" | "domain_crawl" | "firecrawl_agent" | "domain_map";
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
        3. **FAQ и Проблемы (АГЕНТ)**:
           - Использовать "firecrawl_agent" для поиска частых проблем.
           - Стратегия: { type: "firecrawl_agent", queries: ["Найти проблемы и коды ошибок для ${knowns.model || inputRaw}"], schema: { problems: [{ issue: string, solution: string }] } }

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
        5. **Map & Batch (Массовое Обнаружение)**:
           - Если цель - известная страница списка или категории, используйте "domain_map" для поиска всех подстраниц.
           - Стратегия: { type: "domain_map", target_domain: "https://www.nix.ru/price", queries: ["${knowns.model || inputRaw}"] }
        6. **Глубокое Сканирование (Deep Crawl - Focused)**:
           - В режиме DEEP, найдите *конкретную* страницу поддержки или продукта. НЕ сканируйте корень "hp.com".
           - Стратегия: { type: "query", queries: ["site:hp.com ${knowns.model || inputRaw} support", "site:kyocera.ru ${knowns.model || inputRaw} характеристики"] }
           - ИЛИ если уверены: { type: "deep_crawl", target_domain: "hp.com/support", queries: [] }
        7. **Интерактивное Обогащение (Interactions)**:
           - Если данные скрыты за вкладками или требуют локации.
           - Стратегия: { type: "url", target_url: "...", meta: { actions: [{ type: "click", selector: "#specs" }], location: { country: "RU" } } }
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;



        const modelsToTry = [
            useFlashPlanner ? "openrouter/auto" : (model || "openrouter/auto"), // Primary - Dynamic routing
            model || "openrouter/auto", // Secondary 
            "openrouter/auto" // Fallback 
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
                    jsonSchema: AgentPlanSchema,
                    // SOTA: Use Web Plugin for Fast mode to better ground strategies
                    plugins: effectiveMode === 'fast' ? [{ id: "web", max_results: 3 }] : [],
                    routingStrategy: RoutingStrategy.SMART,
                    maxTokens: 4096, // Cap to fit free tier
                    // Bridge UI Logging
                    onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined
                });

                const plan = safeJsonParse(response || "{}");

                // ---------------------------------------------------------
                // "Smarter" Safeguard: Enforce Language Protocol (User: "ALWAYS")
                // ---------------------------------------------------------
                if (effectiveMode === 'deep' && plan.strategies) {
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

                // Attach suggested budget based on effective mode
                if (effectiveMode === 'deep') {
                    plan.suggestedBudget = { mode: 'deep', concurrency: 4, depth: 2 };
                } else if (effectiveMode === 'fast') {
                    plan.suggestedBudget = { mode: 'fast', concurrency: 2, depth: 0 };
                } else {
                    plan.suggestedBudget = { mode: 'balanced', concurrency: 3, depth: 1 };
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
     * "Global Analyst" - The brain of the Deep Research Loop.
     * Analyzes current findings vs. original goal to decide "What's next?"
     * Can trigger:
     * - New Queries (Expansion)
     * - Structured Enrichment (Extraction)
     * - Stop (Sufficient Data)
     */
    static async analyzeProgress(
        jobId: string,
        originalInput: string,
        currentResults: RetrieverResult[],
        language: string = 'en',
        model: string = "openrouter/auto",
        apiKeys?: Record<string, string>,
        onLog?: (msg: string) => void
    ): Promise<{
        action: 'continue' | 'stop';
        new_tasks?: Array<{ type: 'query' | 'enrichment' | 'domain_crawl' | 'firecrawl_agent', value: string, meta?: any }>
    }> {
        // Circuit Breaker for empty results
        if (currentResults.length === 0) return { action: 'continue', new_tasks: [] };

        const systemPrompt = `You are a Global Research Analyst.
        Your goal is to ensure we have "100% Strict" data for the user's request: "${originalInput}".
        
        Current Progress: ${currentResults.length} items found.
        Target Language: ${language.toUpperCase()}

        Analyze the "Snippet" of the top results. 
        - If we found a High-Authority Domain (nix.ru, dns-shop.ru, hp.com, canon.com) but only have the URL, we MUST "enrich" it to get exact specs.
        - **NIX.RU SPECIFIC**: detailed specs are often in a "Характеристики" tab. You MUST add an action to click it.
        - If we have "fuzzy" matches, we need specific queries for the MPN.
        - **Logistics Check**: If we lack "Weight" or "Dimensions", trigger a specific query (e.g. "${originalInput} weight specs").
        - **FAQ Check**: If we lack "Common Problems" or "FAQ", trigger a specific Firecrawl Agent task (e.g. "Find common error codes for ${originalInput}").
        - If we have everything (MPN, Weight, Dims, Compatibility, Image, FAQ), we STOP.

        Return JSON:
        {
            "thoughts": "String explaining your reasoning",
            "action": "continue" | "stop",
            "new_tasks": [
                { 
                    "type": "enrichment", 
                    "value": "https://nix.ru/exact-url", 
                    "goal": "Extract weight and printer compatibility. Click 'Specs' tab if needed.",
                    "meta": {
                        "actions": [
                            { "type": "click", "selector": "text:Характеристики" },
                            { "type": "wait", "milliseconds": 2000 }
                        ],
                        "location": { "country": "RU" }
                    }
                },
                { "type": "query", "value": "Canon GPR-43 specs pdf" },
                { 
                   "type": "firecrawl_agent", 
                   "value": "Find known issues and error codes for Canon GPR-43",
                   "meta": { "schema": { "type": "object", "properties": { "faq": { "type": "array", "items": { "type": "object", "properties": { "q": {"type":"string"}, "a": {"type":"string"} } } } } } }
                }
            ]
        }
        `;

        const context = currentResults.slice(0, 5).map(r =>
            `Domain: ${new URL(r.url).hostname}\nTitle: ${r.title}\nType: ${r.source_type}\nSnippet: ${r.markdown.substring(0, 200)}...`
        ).join("\n---\n");

        try {
            const response = await BackendLLMService.complete({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analyze these results:\n${context}` }
                ],
                jsonSchema: ProgressAnalysisSchema,
                routingStrategy: RoutingStrategy.SMART,
                apiKeys,
                onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined
            });

            const parsed = safeJsonParse(response || "{}");

            // Map "enrichment" goals to schemas immediately? 
            // Better: Return the goal, let the workflow use EnrichmentAgent to build the schema.
            // We return "meta.goal" for the workflow to handle.

            return {
                action: parsed.action || 'continue',
                new_tasks: parsed.new_tasks?.map((t: any) => ({
                    type: t.type,
                    value: t.value,
                    meta: t.type === 'enrichment' ? { goal: t.goal } : undefined
                })) || []
            };

        } catch (e) {
            console.warn("Global Analyst failed", e);
            return { action: 'continue', new_tasks: [] };
        }
    }

    /**
     * Analyzes search results to find new keyword expansion opportunities.
     * Uses Fast/Cheap model to keep costs low.
     */
    static async analyzeForExpansion(originalQuery: string, searchResults: RetrieverResult[], apiKeys?: Record<string, string>, language: string = 'en', onLog?: (msg: string) => void): Promise<string[]> {
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
                jsonSchema: ExpansionSchema,
                routingStrategy: RoutingStrategy.CHEAP,
                apiKeys,
                onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined
            });

            const parsed = safeJsonParse(response || "[]");
            return Array.isArray(parsed) ? parsed : (parsed.queries || []);
        } catch (e) {
            console.warn("Expansion analysis failed", e);
            return [];
        }
    }

    /**
     * Smart Relevance Filter (Phase 3 Optimization).
     * Uses a lightweight, fast LLM to strict-filter search results based on snippets.
     * Prevents scraping of irrelevant pages.
     */
    static async filterResults(results: any[], originalQuery: string, apiKeys?: Record<string, string>, language: string = 'en', onLog?: (msg: string) => void): Promise<number[]> {
        if (results.length === 0) return [];
        if (results.length <= 2) return results.map((_, i) => i); // If very few results, just take them (heuristics likely already applied)

        const isRu = language === 'ru';
        const systemPromptEn = `You are a Search Relevance Judge. 
        Your goal is to filter search results for a SPECIFIC technical research query.
        
        Input:
        1. Query
        2. List of Candidates [ID, Title, Snippet]
        
        Task: 
        Return a JSON array of IDs (integers) that are HIGHLY PROBABLE to contain the answer. 
        Discard "General" pages, ads, random blog spam, or unrelated topics. 
        
        Strictness: HIGH. Better to miss a weak link than scrape garbage.
        Limit: Select max 3 best links.
        `;

        const systemPromptRu = `Вы - Судья Релевантности Поиска.
        Ваша цель - отфильтровать результаты поиска для конкретного технического запроса.
        
        Ввод:
        1. Запрос
        2. Список кандидатов [ID, Заголовок, Сниппет]
        
        Задача:
        Вернуть JSON массив ID (целых чисел), которые с ВЫСОКОЙ ВЕРОЯТНОСТЬЮ содержат ответ.
        Отбрасывайте "Общие" страницы, рекламу, случайные блоги или несвязанные темы.
        
        Строгость: ВЫСОКАЯ. Лучше пропустить слабую ссылку, чем сканировать мусор.
        Лимит: Выберите максимум 3 лучших ссылки.
        `;

        const candidatesCtx = results.map((r, i) =>
            `ID: ${i}\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description || r.markdown || r.content || "No snippet"}`
        ).join("\n---\n");

        try {
            const { ModelProfile } = await import("../../config/models.js");
            const response = await BackendLLMService.complete({
                profile: ModelProfile.FAST_CHEAP, // Key: Cheap model
                messages: [
                    { role: "system", content: isRu ? systemPromptRu : systemPromptEn },
                    { role: "user", content: `Query: "${originalQuery}"\n\nCandidates:\n${candidatesCtx}` }
                ],
                jsonSchema: {
                    type: "object",
                    properties: {
                        selected_ids: {
                            type: "array",
                            items: { type: "integer" }
                        }
                    }
                },
                routingStrategy: RoutingStrategy.CHEAP,
                apiKeys
            });

            const parsed = safeJsonParse(response || "{}");
            const indices = parsed.selected_ids || [];
            return indices.filter((i: any) => typeof i === 'number' && i >= 0 && i < results.length);
        } catch (e) {
            console.warn("Smart Filter failed, falling back to top N", e);
            // Fallback: Return top 3 indices
            return [0, 1, 2].filter(i => i < results.length);
        }
    }

    /**
     * "The Editor" - Automatic Refinement (SOTA 2026)
     * Reviews the synthesized draft for critical missing data points based on the target market.
     * Uses tiered severity scoring for prioritized repair task generation.
     * 
     * SEVERITY TIERS:
     * - TIER1 (BLOCKING): mpn, brand, yield - Cannot proceed without
     * - TIER2 (IMPORTANT): compatible_printers, images, description
     * - TIER3 (ENHANCEMENT): weight, dimensions, faq, compliance_ru
     */
    static async critique(finalData: any, language: string = 'en', apiKeys?: Record<string, string>, onLog?: (msg: string) => void): Promise<Array<{ goal: string, value: string, severity?: 'TIER1' | 'TIER2' | 'TIER3' }>> {
        try {
            const isRu = language === 'ru';

            const systemPrompt = `You are a Strict Data Auditor for a Product Database (SOTA 2026).
            Your job is to review the Final Output JSON and IDENTIFY GAPS using a TIERED SEVERITY system.
            
            Target Market: ${isRu ? 'Russia (RU)' : 'Global (EN)'}
            
            ═══════════════════════════════════════════════════════════════════════════════
            SEVERITY TIERS (Prioritized)
            ═══════════════════════════════════════════════════════════════════════════════
            
            TIER1 - BLOCKING (Must fix immediately):
            - 'mpn' or 'mpn_identity.mpn' is missing/unknown/null → TIER1
            - 'brand' is missing/unknown → TIER1
            - 'yield' or 'tech_specs.yield.value' is missing → TIER1
            
            TIER2 - IMPORTANT (Should fix for quality):
            - 'compatible_printers' array is empty → TIER2
            - 'images' array is empty → TIER2
            - 'description' is missing or too short (<50 chars) → TIER2
            - Target is RU and 'description_ru' is missing/English → TIER2
            
            TIER3 - ENHANCEMENT (Nice to have):
            - 'logistics.package_weight_g' is missing → TIER3
            - 'logistics' dimensions fields are missing → TIER3
            - 'faq' array is empty → TIER3
            - Target is RU and 'compliance_ru' (tn_ved_code, mandatory_marking) is missing → TIER3
            
            ═══════════════════════════════════════════════════════════════════════════════
            OUTPUT FORMAT
            ═══════════════════════════════════════════════════════════════════════════════
            
            Return a JSON array of Repair Tasks, SORTED BY SEVERITY (TIER1 first, then TIER2, then TIER3).
            
            Format: [
                { "severity": "TIER1", "goal": "Find missing MPN", "value": "Model Name + MPN artical number" },
                { "severity": "TIER2", "goal": "Find compatible printers", "value": "Model Name + printers compatibility list" },
                { "severity": "TIER3", "goal": "Find package weight", "value": "Model Name + shipping weight" }
            ]
            
            If NO gaps exist, return [] (empty array).
            
            CRITICAL: Focus on data that is ACTUALLY MISSING, not just potentially incomplete.
            Analyze the actual JSON values, not just field presence.
            `;

            const { ModelProfile } = await import("../../config/models.js");
            const response = await BackendLLMService.complete({
                model: "openrouter/auto",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analyze this product data for gaps:\n${JSON.stringify(finalData, null, 2)}` }
                ],
                routingStrategy: RoutingStrategy.FAST,
                apiKeys,
                onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined
            });

            const parsed = safeJsonParse(response || "[]");
            if (Array.isArray(parsed)) {
                // Sort by severity tier (TIER1 first)
                const severityOrder = { 'TIER1': 0, 'TIER2': 1, 'TIER3': 2 };
                return parsed
                    .map((p: any) => ({
                        goal: p.goal || "Repair gap",
                        value: p.value || "",
                        severity: (p.severity as 'TIER1' | 'TIER2' | 'TIER3') || 'TIER2'
                    }))
                    .sort((a, b) => (severityOrder[a.severity || 'TIER2'] || 1) - (severityOrder[b.severity || 'TIER2'] || 1));
            }
            return [];

        } catch (e) {
            console.warn("Critique failed", e);
            return [];
        }
    }
}
