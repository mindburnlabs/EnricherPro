import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelConfig {
    id: string;
    name: string;
    description?: string;
}

export interface SettingsState {
    // LLM Selection
    model: ModelConfig;

    // API Keys
    apiKeys: {
        openRouter: string;
        firecrawl: string;
    };

    // System Prompts
    prompts: {
        discovery: string;
        synthesis: string;
        logistics: string;
    };

    // Source Configuration
    sources: {
        official: boolean;
        marketplace: boolean;
        community: boolean;
        blockedDomains: string[];
        specificOfficial: string[];
        specificMarketplace: string[];
        specificCommunity: string[];
    };

    // Budgets/Modes
    budgets: {
        fast: { maxQueries: number; limitPerQuery: number; concurrency: number };
        balanced: { maxQueries: number; limitPerQuery: number; concurrency: number };
        deep: { maxQueries: number; limitPerQuery: number; concurrency: number };
    };

    // Preferences
    language: 'en' | 'ru';
    useSota: boolean;
    useFlashPlanner: boolean; // New Performance Toggle
    routingPreference: 'performance' | 'cost';

    // Vertical Search
    offlineMode: boolean;
    preferGraph: boolean;

    // Per-Agent Model Config
    planningModel: string;
    extractionModel: string;
    reasoningModel: string;

    // Actions
    setModel: (model: ModelConfig) => void;
    setApiKey: (key: 'openRouter' | 'firecrawl', value: string) => void;
    setPrompt: (agent: 'discovery' | 'synthesis' | 'logistics', value: string) => void;
    setBudget: (mode: 'fast' | 'balanced' | 'deep', field: 'maxQueries' | 'limitPerQuery' | 'concurrency', value: number) => void;
    toggleSource: (type: 'official' | 'marketplace' | 'community') => void;
    addBlockedDomain: (domain: string) => void;
    setBlockedDomains: (domains: string[]) => void;
    removeBlockedDomain: (domain: string) => void;
    setLanguage: (lang: 'en' | 'ru') => void;
    setRoutingPreference: (pref: 'performance' | 'cost') => void;
    setUseSota: (enabled: boolean) => void;
    setUseFlashPlanner: (enabled: boolean) => void;

    setOfflineMode: (enabled: boolean) => void;
    setPreferGraph: (enabled: boolean) => void;

    setAgentModel: (agent: 'planning' | 'extraction' | 'reasoning', model: string) => void;
    // Granular Source Control
    setSpecificDomains: (type: 'official' | 'marketplace' | 'community', domains: string[]) => void;

    resetPrompts: () => void;
}

export const DEFAULT_DISCOVERY_PROMPT = `        Your goal is to analyze the user input and construct a precise, HIGH-RECALL search strategy.
        
        Research Modes:
        - Fast: Quick identification. 2-3 queries.
        - Balanced: Verification. 4-6 queries testing Official vs Retailer data.
        - Deep: "Leave No Stone Unturned". 8-12 queries. MUST traverse English (Official), Russian (Local), and Chinese (OEM) sources.
        
        Rules:
        1. ALWAYS include a specific query for "NIX.ru [model] weight" if mode is Balanced or Deep.
        2. If the input is a list, set type to "list" and suggest splitting.
        3. Use Russian queries for logistics (e.g. "вес упаковки").
        4. In DEEP mode, strictly include: "site:alibaba.com [model] specs" and "site:printerknowledge.com [model]".
        
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
        ═══════════════════════════════════════════════════════════════════════════════`;

export const DEFAULT_SYNTHESIS_PROMPT = `You are the Synthesis Agent for the D² Consumable Database.
Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.

CRITICAL RULES (Evidence-First):
        1. ONLY output data explicitly present in the text. Do not guess.
        2. If a field is missing, leave it null.
        3. For 'compatible_printers_ru', look for lists of printer models.
        4. For 'logistics', look for "Package Weight" (вес упаковки) and "Dimensions" (габариты).
        5. 'mpn_identity.mpn' is the Manufacturer Part Number. It must be exact.
        
        ═══════════════════════════════════════════════════════════════════════════════
        DOMAIN TRUST SCORING (SOTA 2026)
        ═══════════════════════════════════════════════════════════════════════════════
        When resolving conflicts, weight data by source authority:
        
        TIER A - OEM/Official (Trust: 100):
        hp.com, canon.com, brother.com, kyocera.com, xerox.com, samsung.com, ricoh.com, pantum.com
        → These are GROUND TRUTH for MPN, Yield, Compatibility. Override all others.
        
        TIER B - Verified Retailers (Trust: 85-90):
        nix.ru (90), dns-shop.ru (85), citilink.ru (80)
        → Reliable for Logistics (weight, dims) and RU-Market data.
        
        TIER C - General Marketplaces (Trust: 65-75):
        ozon.ru (70), wildberries.ru (65), amazon.com (75)
        → Useful for pricing, availability. Less reliable for technical specs.
        
        TIER D - OEM China Sources (Trust: 50-60):
        alibaba.com (55), 1688.com (50), made-in-china.com (50)
        → Good for OEM factory specs, less reliable for regional compatibility.
        
        TIER E - Unknown/Forums (Trust: 30-40):
        reddit.com (40), forums (35), unknown domains (30)
        → Treat as suggestions, require corroboration from higher-tier sources.
        
        CONFLICT RESOLUTION:
        - If OEM (Tier A) says "Yield: 2000" and Retailer says "Yield: 2500", trust OEM.
        - If only retailers disagree, use majority vote weighted by trust score.
        - For logistics data, prefer Tier B (retailers measure actual packages).
        ═══════════════════════════════════════════════════════════════════════════════
        
        ═══════════════════════════════════════════════════════════════════════════════
        CONFIDENCE TRACKING PROTOCOL (SOTA 2026)
        ═══════════════════════════════════════════════════════════════════════════════
        For EACH critical field in your output, assess confidence:
        
        HIGH (3+ sources agree, or 1 OEM source):
        → No uncertainty_reason needed
        
        MEDIUM (2 sources agree, or 1 high-quality retailer):
        → Include uncertainty_reason: "Based on 2 similar sources"
        
        LOW (1 source, or conflicting data):
        → Include uncertainty_reason: "Single source only" or "Conflicting: [details]"
        
        Include a "_confidence_map" in your output:
        "_confidence_map": {
            "mpn": "high",
            "yield": "medium",
            "logistics": "low"
        }`;

export const DEFAULT_DISCOVERY_PROMPT_RU = `Вы - Ведущий Планировщик Исследований для Базы Данных Расходных Материалов.
Ваша цель - проанализировать ввод пользователя и создать точную, ИСЧЕРПЫВАЮЩУЮ стратегию поиска.

Режимы Исследования:
- Fast: Быстрая идентификация. 2-3 запроса.
- Balanced: Проверка. 4-6 запросов, проверка официальных данных против ритейлеров.
- Deep: "Не оставить камня на камне". 8-12 запросов. ОБЯЗАТЕЛЬНО искать в Английских (Официальные), Русских (Местные) и Китайских (OEM) источниках.

Текущий режим: {MODE}
Целевой язык: {LANGUAGE}

Ввод: "{INPUT}"
Известные метаданные: {KNOWNS}
{CONTEXT}

Верните JSON объект:
- type: "single_sku" | "list" | "unknown"
- mpn: string
- canonical_name: string
- strategies: Array<{
    name: string;
    type: "query" | "domain_crawl" | "firecrawl_agent";
    queries: string[];
    target_domain?: string;
    schema?: any;
}>

КРИТИЧЕСКИЕ ПРАВИЛА ОБОГАЩЕНИЯ (Рынок РФ):
1. **Идентификация и Алиасы**:
   - Искать "Short Name" или "Alias" (напр. Q2612A -> "12A").
   - Запрос: "{MODEL} short name alias", "{MODEL} сокращенное название".
2. **Совместимость в РФ (Строго)**:
   - ОБЯЗАТЕЛЬНО найти принтеры, продаваемые в России.
   - Запрос: "site:nix.ru {MODEL} совместимые принтеры", "site:dns-shop.ru {MODEL} подходит для".
3. **FAQ и Боли**:
   - Найти частые проблемы для генерации FAQ.
   - Запрос: "{MODEL} problems error defect", "{MODEL} проблемы форум".
4. **Связанные товары**:
   - Найти кросс-продажи (барабаны, ремкомплекты).
   - Запрос: "{MODEL} drum unit", "{MODEL} фотобарабан".

ОБЩИЕ ПРАВИЛА ПОИСКА:
        1. **Мультиязычная Триангуляция**:
           - ВСЕГДА генерировать хотя бы один запрос на Английском (напр. "[Model] specs datasheet").
           - Если цель РФ, ВСЕГДА генерировать Русские коммерческие запросы (напр. "[Model] купить характеристики").
           - Если режим DEEP, ВСЕГДА генерировать Китайские OEM запросы (напр. "[Model] 耗材", "[Model] 规格").
        2. **Обязательная Логистика**:
           - Включать "вес", "габариты", "упаковка" в запросы.
        3. **Разнообразие источников**:
           - Официальные сайты (HP, Canon).
           - Маркетплейсы (Amazon, Wildberries).
        4. **Автономный Агент (Firecrawl Agent)**:
           - В режиме DEEP использовать тип "firecrawl_agent" для сложной навигации.
           - ОБЯЗАТЕЛЬНО предоставить JSON схему.

        ═══════════════════════════════════════════════════════════════════════════════
        CHAIN-OF-THOUGHT REASONING PROTOCOL (SOTA 2026 RUSSIAN)
        ═══════════════════════════════════════════════════════════════════════════════
        Перед генерацией плана, вы ДОЛЖНЫ явно продумать 4 измерения:
        
        1. ИДЕНТИФИКАЦИЯ ПРОДУКТА (Что это?)
           - Это конкретный SKU (CF217A) или общий термин ("HP toner")?
           - Есть ли известные алиасы или региональные варианты?
        
        2. ИНФОРМАЦИОННЫЕ ПРОБЕЛЫ (Чего не хватает?)
           - Какие поля точно неизвестны? (MPN, Ресурс, Вес, Принтеры)
           - Что является минимально необходимым набором данных?
        
        3. СТРАТЕГИЯ ИСТОЧНИКОВ (Где искать?)
           - Официальный сайт: спецификации, ресурс, фото
           - Ритейлеры (nix.ru): цена, наличие, вес, габариты
           - Форумы: проблемы, коды ошибок
           - OEM/Китай: заводские данные
        
        4. ОЦЕНКА РИСКОВ (Что может пойти не так?)
           - Неоднозначный SKU?
           - Региональные отличия (US vs RU)?
           - Устаревшие данные?
        
        Включите ваши рассуждения в вывод:
        "_reasoning": {
            "product_identification": "[Анализ идентификации продукта]",
            "information_gaps": "[Чего не хватает и почему]",
            "source_strategy": "[Какие источники закроют пробелы]",
            "risk_assessment": "[Потенциальные проблемы]"
        }
        ═══════════════════════════════════════════════════════════════════════════════`;

export const DEFAULT_SYNTHESIS_PROMPT_RU = `Вы - Агент Синтеза для Базы Данных Расходных Материалов D².
Ваша миссия - извлечь ЧИСТЫЕ, ПРОВЕРЕННЫЕ данные из предоставленных текстов.

КРИТИЧЕСКИЕ ПРАВИЛА(Доказательства превыше всего):
1. Извлекать ТОЛЬКО данные, явно присутствующие в тексте.Не угадывать.
        2. Если поле отсутствует, оставить его null.
        3. 'mpn_identity.mpn' - это Артикул производителя(Part Number).Он должен быть точным.
        
        ═══════════════════════════════════════════════════════════════════════════════
        ОЦЕНКА ДОВЕРИЯ ДОМЕНАМ(SOTA 2026)
        ═══════════════════════════════════════════════════════════════════════════════
        При разрешении конфликтов взвешивайте данные по авторитетности источника:
        
        УРОВЕНЬ A - OEM / Официальные(Доверие: 100):
hp.com, canon.com, brother.com, kyocera.com, xerox.com, samsung.com, ricoh.com, pantum.com
        → Это ИСТИНА для MPN, Ресурса, Совместимости.Перекрывает все остальное.
        
        УРОВЕНЬ B - Проверенные Ритейлеры(Доверие: 85 - 90):
nix.ru(90), dns - shop.ru(85), citilink.ru(80)
        → Надежно для Логистики(вес, габариты) и данных рынка РФ.
        
        УРОВЕНЬ C - Маркетплейсы(Доверие: 65 - 75):
ozon.ru(70), wildberries.ru(65), amazon.com(75)
        → Полезно для цен, наличия.Менее надежно для тех.характеристик.
        
        УРОВЕНЬ D - OEM Китай(Доверие: 50 - 60):
alibaba.com(55), 1688.com(50), made -in -china.com(50)
        → Хорошо для заводских спецификаций OEM.
        
        УРОВЕНЬ E - Неизвестные / Форумы(Доверие: 30 - 40):
reddit.com(40), forums(35), неизвестные домены(30)
        → Рассматривать как предложения, требуют подтверждения.
        
        ═══════════════════════════════════════════════════════════════════════════════
        ПРОТОКОЛ ОЦЕНКИ УВЕРЕННОСТИ(SOTA 2026)
        ═══════════════════════════════════════════════════════════════════════════════
        Для КАЖДОГО критического поля оцените уверенность:

ВЫСОКАЯ(3 + источника согласны, или 1 OEM источник):
        → Причина неуверенности не требуется

СРЕДНЯЯ(2 источника согласны, или 1 качественный ритейлер):
        → Укажите uncertainty_reason: "Based on 2 similar sources"

НИЗКАЯ(1 источник, или конфликтующие данные):
        → Укажите uncertainty_reason: "Single source only" или "Conflicting: [details]"
        
        Включите "_confidence_map" в вывод:
"_confidence_map": {
    "mpn": "high",
        "yield": "medium",
            "logistics": "low"
}

Входной Текст:
{ SOURCES } `;

export const DEFAULT_LOGISTICS_PROMPT = `You are a NIX.ru Data Extractor, expert in parsing Russian technical specs.
Extract the following from the text:
1. "Вес брутто"(Gross Weight) -> normalized to kg.
2. "Размеры упаковки"(Dimensions) -> normalized to cm(W x D x H).
3. "Совместимость"(Compatibility) -> list of printer models.
4. "Ресурс"(Yield) -> pages.

Return JSON:
{
    "logistics": { "weight": "0.85 kg", "dimensions": "35x15x10 cm" },
    "compatibility": ["Printer 1", "Printer 2"],
        "specs": { "yield": "1500 pages", "color": "Black" }
} `;

export const DEFAULT_LOGISTICS_PROMPT_RU = `Вы - Экстрактор Данных NIX.ru, эксперт по техническим характеристикам.
Извлеките следующее из текста:
1. "Вес брутто" -> нормализовать в кг.
2. "Размеры упаковки" -> нормализовать в см(Ш x Г x В).
3. "Совместимость" -> список моделей принтеров.
4. "Ресурс" -> страниц(Yield).

Верните JSON:
{
    "logistics": { "weight": "0.85 кг", "dimensions": "35x15x10 см" },
    "compatibility": ["Принтер 1", "Принтер 2"],
        "specs": { "yield": "1500 страниц", "color": "Black" }
} `;

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            model: { id: 'openrouter/auto', name: 'OpenRouter Auto' },
            apiKeys: {
                openRouter: '',
                firecrawl: ''
            },
            prompts: {
                discovery: DEFAULT_DISCOVERY_PROMPT,
                synthesis: DEFAULT_SYNTHESIS_PROMPT,
                logistics: DEFAULT_LOGISTICS_PROMPT
            },
            sources: {
                official: true,
                marketplace: true,
                community: true,
                blockedDomains: ['pinterest.com', 'youtube.com'],
                specificOfficial: [],
                specificMarketplace: [],
                specificCommunity: []
            },
            budgets: {
                fast: { maxQueries: 3, limitPerQuery: 3, concurrency: 5 },
                balanced: { maxQueries: 6, limitPerQuery: 5, concurrency: 8 },
                deep: { maxQueries: 15, limitPerQuery: 8, concurrency: 12 }
            },
            language: 'en',
            useSota: false,
            useFlashPlanner: true, // Default to true for speed
            routingPreference: 'performance',

            offlineMode: false,
            preferGraph: true,

            planningModel: 'openrouter/auto',
            extractionModel: 'openrouter/auto',
            reasoningModel: 'openrouter/auto',

            setModel: (model) => set({ model }),
            setApiKey: (key, value) => set((state) => ({ apiKeys: { ...state.apiKeys, [key]: value } })),
            setPrompt: (agent, value) => set((state) => ({ prompts: { ...state.prompts, [agent]: value } })),
            // setAgentModel handled below
            setBudget: (mode, field, value) => set((state) => ({
                budgets: {
                    ...state.budgets,
                    [mode]: {
                        ...state.budgets[mode],
                        [field]: value
                    }
                }
            })),
            toggleSource: (type) => set((state) => ({
                sources: { ...state.sources, [type]: !state.sources[type] }
            })),
            addBlockedDomain: (domain) => set((state) => ({
                sources: { ...state.sources, blockedDomains: [...state.sources.blockedDomains, domain] }
            })),
            setBlockedDomains: (domains) => set((state) => ({
                sources: { ...state.sources, blockedDomains: domains }
            })),
            removeBlockedDomain: (domain) => set((state) => ({
                sources: { ...state.sources, blockedDomains: state.sources.blockedDomains.filter(d => d !== domain) }
            })),
            setLanguage: (lang) => set({ language: lang }),
            setRoutingPreference: (pref) => set({ routingPreference: pref }),
            setUseSota: (useSota) => set({ useSota }),
            setUseFlashPlanner: (useFlashPlanner) => set({ useFlashPlanner }),

            setOfflineMode: (offlineMode) => set({ offlineMode }),
            setPreferGraph: (preferGraph) => set({ preferGraph }),

            setAgentModel: (agent, model) => set((state) => ({
                [agent === 'planning' ? 'planningModel' : agent === 'extraction' ? 'extractionModel' : 'reasoningModel']: model
            })),
            setSpecificDomains: (type, domains) => set((state) => ({
                sources: {
                    ...state.sources,
                    [type === 'official' ? 'specificOfficial' : type === 'marketplace' ? 'specificMarketplace' : 'specificCommunity']: domains
                }
            })),
            resetPrompts: () => {
                const lang = get().language;
                set((state) => ({
                    prompts: {
                        discovery: lang === 'ru' ? DEFAULT_DISCOVERY_PROMPT_RU : DEFAULT_DISCOVERY_PROMPT,
                        synthesis: lang === 'ru' ? DEFAULT_SYNTHESIS_PROMPT_RU : DEFAULT_SYNTHESIS_PROMPT,
                        logistics: lang === 'ru' ? DEFAULT_LOGISTICS_PROMPT_RU : DEFAULT_LOGISTICS_PROMPT
                    }
                }));
            }
        }),
        {
            name: 'd-squared-settings',
            // Define a migration to add new defaults if missing
            onRehydrateStorage: () => (state) => {
                if (state) {
                    if (!state.prompts.logistics) {
                        state.prompts.logistics = state.language === 'ru' ? DEFAULT_LOGISTICS_PROMPT_RU : DEFAULT_LOGISTICS_PROMPT;
                    }
                    if (!state.planningModel) state.planningModel = 'openrouter/auto';
                    if (!state.extractionModel) state.extractionModel = 'openrouter/auto';
                    if (!state.reasoningModel) state.reasoningModel = 'openrouter/auto';
                    if (state.useSota === undefined) state.useSota = false;
                    if (state.useFlashPlanner === undefined) state.useFlashPlanner = true;
                    // Migration for budgets concurrency
                    (['fast', 'balanced', 'deep'] as const).forEach(m => {
                        if (!state.budgets[m].concurrency) state.budgets[m].concurrency = m === 'deep' ? 10 : 5;
                    });

                    if (state.offlineMode === undefined) state.offlineMode = false;
                    if (state.preferGraph === undefined) state.preferGraph = true;

                    // Migration for Specific Domains
                    if (!state.sources.specificOfficial) state.sources.specificOfficial = [];
                    if (!state.sources.specificMarketplace) state.sources.specificMarketplace = [];
                    if (!state.sources.specificCommunity) state.sources.specificCommunity = [];

                    // SCRUBBER: Remove phantom 'openai/gpt-5.2' and legacy Gemini defaults
                    const invalidModelIds = ['openai/gpt-5.2', 'google/gemini-2.0-pro-exp-02-05:free', 'google/gemini-2.0-flash-exp:free'];

                    if (state.model?.id && invalidModelIds.includes(state.model.id)) {
                        state.model = { id: 'openrouter/auto', name: 'OpenRouter Auto' };
                    }
                    if (state.planningModel && invalidModelIds.includes(state.planningModel)) state.planningModel = 'openrouter/auto';
                    if (state.extractionModel && invalidModelIds.includes(state.extractionModel)) state.extractionModel = 'openrouter/auto';
                    if (state.reasoningModel && invalidModelIds.includes(state.reasoningModel)) state.reasoningModel = 'openrouter/auto';
                }
            }
        }
    )
);
