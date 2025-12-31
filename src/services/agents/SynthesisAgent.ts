
import { BackendLLMService } from "../backend/llm.js";
import { ConsumableData } from "../../types/domain.js";
import { ModelProfile } from "../../config/models.js";

interface ExtractedClaim {
    field: string;
    value: any;
    confidence: number;
    rawSnippet: string;
}

export class SynthesisAgent {

    /**
     * Extracts atomic claims from a single source document.
     * PREFERS: High-speed, cheap models (ModelProfile.EXTRACTION)
     */
    static async extractClaims(sourceText: string, sourceUrl: string, apiKeys?: Record<string, string>, promptOverride?: string, modelOverride?: string | { id: string }, language: string = 'en'): Promise<ExtractedClaim[]> {
        const isRu = language === 'ru';

        const systemPromptEn = promptOverride || `You are an Extraction Engine.
        Your goal is to parse the input text and extract structured facts (Claims) about a printer consumable (Toners, Ink, Drums).
        
        Output JSON:
        [
            { "field": "brand", "value": "HP", "confidence": 1.0, "rawSnippet": "HP 85A" },
            { "field": "mpn_identity.mpn", "value": "CE285A", "confidence": 1.0, "rawSnippet": "Model: CE285A" },
            { "field": "packaging.weight_g", "value": 850, "confidence": 0.8, "rawSnippet": "0.85 kg" }
        ]
        
        Targets:
        - brand, mpn, series, color
        - yield (pages)
        - compatible_printers (array of strings)
        - logistics (weight_g, dim_width_mm, dim_height_mm, dim_depth_mm)
        - gtin/ean codes
        
        Rules:
        1. Extract ONLY present data. No guessing.
        2. Normalize numeric values (e.g. "1 kg" -> 1000).
        3. Confidence 0.1-1.0 based on clarity.
        `;

        const systemPromptRu = `Вы - Движок Извлечения Данных.
        Ваша цель - проанализировать текст и извлечь структурированные факты (Claims) о расходных материалах (Тонеры, Чернила, Барабаны).
        
        Выходной JSON:
        [
            { "field": "brand", "value": "HP", "confidence": 1.0, "rawSnippet": "HP 85A" },
            { "field": "mpn_identity.mpn", "value": "CE285A", "confidence": 1.0, "rawSnippet": "Model: CE285A" },
            { "field": "packaging.weight_g", "value": 850, "confidence": 0.8, "rawSnippet": "0.85 kg" }
        ]
        
        Цели:
        - brand, mpn, series, color
        - yield (pages - ресурс)
        - compatible_printers (массив моделей принтеров)
        - logistics (weight_g, dim_width_mm, dim_height_mm, dim_depth_mm)
        - gtin/ean codes
        
        Правила:
        1. Извлекать ТОЛЬКО присутствующие данные. Не гадать.
        2. Нормализовать числовые значения (напр. "1 кг" -> 1000).
        3. Уверенность (confidence) 0.1-1.0 на основе четкости.
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

        try {
            const response = await BackendLLMService.complete({
                model: typeof modelOverride === 'string' ? modelOverride : modelOverride?.id,
                profile: modelOverride ? undefined : ModelProfile.EXTRACTION, // Use Cheap/Fast model if no override
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Source URL: ${sourceUrl}\n\n${sourceText.substring(0, 15000)}` } // Limit context window for cheap models
                ],
                jsonSchema: true,
                apiKeys
            });

            const parsed = JSON.parse(response || "[]");
            return Array.isArray(parsed) ? parsed : (parsed.claims || []);
        } catch (error) {
            console.error(`Extraction failed for ${sourceUrl}:`, error);
            return [];
        }
    }

    static async merge(sources: string[], schemaKey: string = "StrictConsumableData", apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, modelOverride?: string | { id: string }, language: string = 'en'): Promise<Partial<ConsumableData>> {
        onLog?.(`Synthesizing data from ${sources.length} sources...`);

        const isRu = language === 'ru';

        const systemPromptEn = promptOverride || `You are the Synthesis Agent for the D² Consumable Database.
        Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.
        
        CRITICAL RULES (Evidence-First):
        1. ONLY output data explicitly present in the text. Do not guess.
        2. If a field is missing, leave it null.
        3. 'mpn_identity.mpn' is the Manufacturer Part Number. It must be exact.
        
        TARGET STRUCTURE (StrictConsumableData):
        - aliases: Array of strings (e.g. "12A" for "Q2612A", "725" for "Canon 725").
        - compatible_printers_ru: Array of objects { model: string, canonicalName: string }.
          * MUST be list of printers compatible with this cartridge.
          * Prioritize lists from NIX.ru or DNS-Shop.
        - faq: Array of { question: string, answer: string, source_url: string }.
          * Extract "Common Problems", "Q&A" sections.
          * Focus on errors, reset instructions, and defects.
        - related_skus: Array of strings (e.g. associated Drums, Maintenance Kits).
        - images: Array of { url: string, width: number, height: number, white_bg_score: number }.
          * FILTER STRICTLY: Must be product-only (no box), white background preferred.
        - logistics: { weight_g: number, width_mm: number, height_mm: number, depth_mm: number }.
          * PRIORITIZE NIX.ru data.
        
        4. PRIORITIZE data from NIX.ru for logistics (weight, dimensions).
        5. PRIORITIZE data from Official sources (hp.com, etc) for technical specs (yield, color).
        
        You must populate the '_evidence' object for every extracted field.
        The '_evidence' object keys match the data keys (e.g., 'brand' -> '_evidence.brand').
        For each evidence field, provide:
        - value: The extracted value
        - raw_snippet: The exact substring from the text where you found it (citability).
        - source_url: The URL of the source text.
        - confidence: 0.0 to 1.0. 
            * 1.0 = Explicitly stated in NIX.ru or Official Specs.
            * 0.8 = Explicitly stated in retailer store.
            * 0.5 = Inferred or vague.
            * 0.1 = Guessed (AVOID).
        
        Input Text:
        ${sources.join("\n\n")}
        `;

        const systemPromptRu = `Вы - Агент Синтеза для Базы Данных Расходных Материалов D².
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
        - raw_snippet: Точная цитата из текста.
        - source_url: URL источника.
        - confidence: 0.0 до 1.0. 
            * 1.0 = Явно указано на NIX.ru или Официальном сайте.
            * 0.8 = Явно указано в магазине.
            * 0.5 = Предположительно.
            * 0.1 = Угадано (ИЗБЕГАТЬ).
        
        Входной Текст:
        ${sources.join("\n\n")}
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

        try {
            const response = await BackendLLMService.complete({
                model: typeof modelOverride === 'string' ? modelOverride : modelOverride?.id,
                profile: modelOverride ? undefined : ModelProfile.REASONING, // Use Smart/Reasoning model if no override
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Extract data according to StrictConsumableData schema." }
                ],
                jsonSchema: true,
                apiKeys
            });

            const parsed = JSON.parse(response || "{}");

            // Post-processing
            if (parsed._evidence) {
                const now = new Date().toISOString();
                for (const key of Object.keys(parsed._evidence)) {
                    if (parsed._evidence[key]) {
                        parsed._evidence[key].timestamp = now;
                    }
                }
            }

            return parsed;
        } catch (error) {
            console.error("SynthesisAgent Merge Failed:", error);
            return {};
        }
    }
}
