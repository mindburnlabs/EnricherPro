
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
    };

    // Budgets/Modes
    budgets: {
        fast: { maxQueries: number; limitPerQuery: number };
        balanced: { maxQueries: number; limitPerQuery: number };
        deep: { maxQueries: number; limitPerQuery: number };
    };

    // Preferences
    language: 'en' | 'ru';
    useSota: boolean;
    routingPreference: 'performance' | 'cost';

    // Per-Agent Model Config
    planningModel: string;
    extractionModel: string;
    reasoningModel: string;

    // Actions
    setModel: (model: ModelConfig) => void;
    setApiKey: (key: 'openRouter' | 'firecrawl', value: string) => void;
    setPrompt: (agent: 'discovery' | 'synthesis' | 'logistics', value: string) => void;
    setBudget: (mode: 'fast' | 'balanced' | 'deep', field: 'maxQueries' | 'limitPerQuery', value: number) => void;
    toggleSource: (type: 'official' | 'marketplace' | 'community') => void;
    addBlockedDomain: (domain: string) => void;
    setBlockedDomains: (domains: string[]) => void;
    removeBlockedDomain: (domain: string) => void;
    setLanguage: (lang: 'en' | 'ru') => void;
    setRoutingPreference: (pref: 'performance' | 'cost') => void;
    setAgentModel: (agent: 'planning' | 'extraction' | 'reasoning', model: string) => void;
    resetPrompts: () => void;
}

export const DEFAULT_DISCOVERY_PROMPT = `You are the Lead Research Planner for a Printer Consumables Database.
Your goal is to analyze the user input and construct a precise search strategy.

Research Modes:
- Fast: Focus on quick identification and basic specs. 1-2 generic queries.
- Balanced: Verify against NIX.ru, official sources, and major retailers. 3-4 queries.
- Deep: Exhaustive search. Include Chinese marketplaces (Alibaba/Taobao) for OEM parts, and Legacy Forums (FixYourOwnPrinter) for obscure specs. 5-7 queries.

Rules:
1. ALWAYS include a specific query for "NIX.ru [model] weight" if mode is Balanced or Deep.
2. If the input is a list, set type to "list" and suggest splitting.
3. Use Russian queries for logistics (e.g. "вес упаковки").
4. In DEEP mode, strictly include: "site:alibaba.com [model] specs" and "site:printerknowledge.com [model]".`;

export const DEFAULT_SYNTHESIS_PROMPT = `You are the Synthesis Agent for the D² Consumable Database.
Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.

CRITICAL RULES (Evidence-First):
1. ONLY output data explicitly present in the text. Do not guess.
2. If a field is missing, leave it null.
3. For 'compatible_printers_ru', look for lists of printer models.
4. For 'logistics', look for "Package Weight" (вес упаковки) and "Dimensions" (габариты).
5. 'mpn_identity.mpn' is the Manufacturer Part Number. It must be exact.
6. PRIORITIZE data from NIX.ru for logistics vs others.
7. PRIORITIZE Official sources (hp.com, etc) for specs.`;

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
   - ОБЯЗАТЕЛЬНО предоставить JSON схему.`;

export const DEFAULT_SYNTHESIS_PROMPT_RU = `Вы - Агент Синтеза для Базы Данных Расходных Материалов D².
Ваша миссия - извлечь ЧИСТЫЕ, ПРОВЕРЕННЫЕ данные из предоставленных текстов.

КРИТИЧЕСКИЕ ПРАВИЛА (Доказательства превыше всего):
1. Извлекать ТОЛЬКО данные, явно присутствующие в тексте. Не угадывать.
2. Если поле отсутствует, оставить его null.
3. 'mpn_identity.mpn' - это Артикул производителя (Part Number). Он должен быть точным.

ЦЕЛЕВАЯ СТРУКТУРА (JSON ключи на английском):
- aliases: Массив строк (напр. "12A" для "Q2612A").
- compatible_printers_ru: Массив объектов { model: string, canonicalName: string }.
  * Список принтеров, совместимых с этим картриджем.
  * Приоритет спискам с NIX.ru или DNS-Shop.
- faq: Массив объектов { question: string (На Русском), answer: string (На Русском), source_url: string }.
  * Извлекать разделы "Частые вопросы", "Проблемы", "Ошибки".
- related_skus: Массив строк (связанные товары, барабаны).
- images: Массив { url: string, width: number, height: number, white_bg_score: number }.
  * ФИЛЬТР: Только сам продукт (без упаковки), белый фон.
- logistics: { weight_g: number, width_mm: number, height_mm: number, depth_mm: number }.
  * ПРИОРИТЕТ данным с NIX.ru.

4. ПРИОРИТЕТ NIX.ru для логистики (вес, габариты).
5. ПРИОРИТЕТ Официальным сайтам (HP, и т.д.) для тех. характеристик (ресурс, цвет).

Вы должны заполнить объект '_evidence' для каждого извлеченного поля.
Ключи '_evidence' совпадают с ключами данных (напр., 'brand' -> '_evidence.brand').
Для каждого поля evidence укажите:
- value: Извлеченное значение
- raw_snippet: Точный фрагмент текста, где найдено (цитируемость).
- source_url: URL источника.
- confidence: 0.0 до 1.0. 
    * 1.0 = Явно указано на NIX.ru или Официальном сайте.
    * 0.8 = Явно указано в магазине ритейлера.
    * 0.5 = Косвенно или неясно.
    * 0.1 = Догадка (ИЗБЕГАТЬ).

Входной Текст:
{SOURCES}`;

export const DEFAULT_LOGISTICS_PROMPT = `You are a NIX.ru Data Extractor, expert in parsing Russian technical specs.
Extract the following from the text:
1. "Вес брутто" (Gross Weight) -> normalized to kg.
2. "Размеры упаковки" (Dimensions) -> normalized to cm (W x D x H).
3. "Совместимость" (Compatibility) -> list of printer models.
4. "Ресурс" (Yield) -> pages.

Return JSON:
{
    "logistics": { "weight": "0.85 kg", "dimensions": "35x15x10 cm" },
    "compatibility": ["Printer 1", "Printer 2"],
    "specs": { "yield": "1500 pages", "color": "Black" }
}`;

export const DEFAULT_LOGISTICS_PROMPT_RU = `Вы - Экстрактор Данных NIX.ru, эксперт по техническим характеристикам.
Извлеките следующее из текста:
1. "Вес брутто" -> нормализовать в кг.
2. "Размеры упаковки" -> нормализовать в см (Ш x Г x В).
3. "Совместимость" -> список моделей принтеров.
4. "Ресурс" -> страниц (Yield).

Верните JSON:
{
    "logistics": { "weight": "0.85 кг", "dimensions": "35x15x10 см" },
    "compatibility": ["Принтер 1", "Принтер 2"],
    "specs": { "yield": "1500 страниц", "color": "Black" }
}`;

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
                blockedDomains: ['pinterest.com', 'youtube.com']
            },
            budgets: {
                fast: { maxQueries: 3, limitPerQuery: 3 },
                balanced: { maxQueries: 6, limitPerQuery: 5 },
                deep: { maxQueries: 15, limitPerQuery: 8 }
            },
            language: 'en',
            useSota: false,
            routingPreference: 'performance',

            planningModel: 'openrouter/auto',
            extractionModel: 'openrouter/auto',
            reasoningModel: 'openrouter/auto',

            setModel: (model) => set({ model }),
            setApiKey: (key, value) => set((state) => ({ apiKeys: { ...state.apiKeys, [key]: value } })),
            setPrompt: (agent, value) => set((state) => ({ prompts: { ...state.prompts, [agent]: value } })),
            setAgentModel: (agent, model) => set((state) => {
                const key = `${agent}Model` as keyof SettingsState;
                return { [key]: model } as Partial<SettingsState>;
            }),
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
