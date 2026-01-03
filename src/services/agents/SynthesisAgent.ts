
import { BackendLLMService, RoutingStrategy } from "../backend/llm.js";
import { safeJsonParse } from "../../lib/json.js";
import { ConsumableData } from "../../types/domain.js";
import { ModelProfile } from "../../config/models.js";
import { ExtractionSchema, ConsumableDataSchema } from "../../schemas/agent_schemas.js";

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

        // Resolve model: explicit override > settings store > default
        const { useSettingsStore } = await import('../../stores/settingsStore.js');
        const state = useSettingsStore.getState(); // Access state directly
        // Note: extractionModel is the key in settingsStore for the Parser agent
        const storeModel = state.extractionModel;

        let effectiveModel = (typeof modelOverride === 'string' ? modelOverride : modelOverride?.id) || storeModel;

        // Fallback only if BOTH are missing
        if (!effectiveModel) {
            effectiveModel = 'google/gemini-2.0-flash-exp:free'; // 2026 Default Free Fallback
        }

        console.log(`[SynthesisAgent] Extracting with model: ${effectiveModel}`);



        const systemPromptEn = promptOverride || `You are an Extraction Engine.
        Your goal is to parse the input text and extract structured facts (Claims) about a printer consumable.
        
        Targets:
        - brand, mpn_identity.mpn (Use dot notation)
        - consumable_type (Enum: toner_cartridge, drum_unit, ink_cartridge, maintenance_kit, waste_toner, bottle, other)
        - yield.value, yield.unit (Use dot notation)
        - compatible_printers_ru (array of objects {model, canonicalName})
        - packaging_from_nix.weight_g, packaging_from_nix.width_mm (Use dot notation)
        - gtin (array of strings)
        - short_model (e.g. "12A", "CF218A" -> "18A")
        - faq (3-5 common questions/problems)
        - related_ids (drums, chips, maintenance)
        
        Rules:
        1. Extract ONLY present data. No guessing.
        2. Normalize numeric values (e.g. "1 kg" -> 1000).
        3. Confidence 0.1-1.0 based on clarity.
        4. CRITICAL: For nested fields, use DOT NOTATION in 'field' property.
           - "mpn" -> "mpn_identity.mpn"
           - "weight" -> "packaging_from_nix.weight_g"
           - "yield" -> "yield.value"
        `;

        const systemPromptRu = `Вы - Движок Извлечения Данных.
        Ваша цель - проанализировать текст и извлечь структурированные факты (Claims).
        
        Цели:
        - brand, mpn_identity.mpn
        - consumable_type (Тип: toner_cartridge, drum_unit, ink_cartridge, maintenance_kit, другие)
        - yield.value, yield.unit
        - compatible_printers_ru
        - packaging_from_nix.weight_g
        - gtin
        - short_model
        - faq
        - related_ids
        
        Правила:
        1. Извлекать ТОЛЬКО присутствующие данные.
        2. Нормализовать числа.
        3. ИСПОЛЬЗОВАТЬ ТОЧКУ для вложенных полей:
           - 'yield.value'
           - 'packaging_from_nix.weight_g'
           - 'mpn_identity.mpn'
        - gtin/ean codes
        - short_model (короткий номер, напр. "12A")
        - faq (3-5 частых вопросов/проблем)
        - related_consumables (барабаны, чипы)
        
        Правила:
        1. Извлекать ТОЛЬКО присутствующие данные. Не гадать.
        2. Нормализовать числовые значения (напр. "1 кг" -> 1000).
        3. Уверенность (confidence) 0.1-1.0 на основе четкости.
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

        try {
            const response = await BackendLLMService.complete({
                model: effectiveModel,
                profile: modelOverride ? undefined : ModelProfile.EXTRACTION, // Use Cheap/Fast model if no override
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Source URL: ${sourceUrl}\n\n${sourceText.substring(0, 15000)}` } // Limit context window for cheap models
                ],
                jsonSchema: ExtractionSchema,
                routingStrategy: RoutingStrategy.FAST, // Extraction is high volume
                apiKeys
            });

            const parsed = safeJsonParse(response || "[]");
            return Array.isArray(parsed) ? parsed : (parsed.claims || []);
        } catch (error) {
            console.error(`Extraction failed for ${sourceUrl}:`, error);
            return [];
        }
    }

    static async merge(sources: string[], schemaKey: string = "StrictConsumableData", apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, modelOverride?: string | { id: string }, language: string = 'en', originalInput?: string): Promise<Partial<ConsumableData>> {
        onLog?.(`Synthesizing data from ${sources.length} sources...`);

        const isRu = language === 'ru';

        const { useSettingsStore } = await import('../../stores/settingsStore.js');
        const state = useSettingsStore.getState();
        const storeModel = state.reasoningModel; // Synthesis uses the Reasoning/Reasoning model

        let effectiveModel = (typeof modelOverride === 'string' ? modelOverride : modelOverride?.id) || storeModel;

        if (!effectiveModel) {
            effectiveModel = 'google/gemini-2.0-flash-exp:free';
        }

        onLog?.(`Synthesizing data with ${effectiveModel}...`);

        const inputGroundingPrompt = originalInput ? `
        CRITICAL INPUT GROUNDING:
        The User explicitly requested: "${originalInput}"
        TRUST this input as a HIGH-CONFIDENCE source. 
        - If the user says "W1331X", then the Model IS "W1331X".
        - If the user says "HP", then the Brand IS "HP".
        - If the user says "15K", then the Yield IS "15000 pages".
        DO NOT return "Unknown" for these fields if they are in the input.
        ` : "";

        const systemPromptEn = promptOverride || `You are the Synthesis Agent for the D² Consumable Database.
        Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.
        
        ${inputGroundingPrompt}

        STRATEGY:
        1. Identify exact MPN, Brand, and Model.
        2. Aggregate specs (Yield, Color, Chip).
        3. ANALYZE COMPATIBILITY: List all compatible printers.
        4. GENERATE MARKETING CONTENT:
            - SEO Title (H1): [Brand] [Type] for [Main Printers] ([Color], [Yield])
            - Description: Sales-oriented HTML description with key benefits.
            - Feature Bullets: 5 key selling points for marketplaces.
            - Keywords: SEO tags for search.

        CRITICAL RULES (Evidence-First):
        1. ONLY output data explicitly present in the text OR in the Inputs.
        2. 'mpn_identity.mpn': Manufacturer Part Number. Must be exact.
        3. 'brand': HIGH PRIORITY. Infer from MPN if needed.
        4. 'yield': Extract value and unit. Default to "pages" if number implies yield.
        5. 'short_model': Extract the short alias (e.g. "CF218A" -> "18A").
        6. 'faq': Extract 3-5 common user questions/problems (e.g. "How to reset chip?").
        7. 'related_ids': Extract list of related consumables (drums, maintenance).

        Input Text:
        ${sources.join("\n\n")}
        `;

        const systemPromptRu = `Вы - Агент Синтеза D².
        Ваша миссия - извлечь ЧИСТЫЕ данные.
        
        ${inputGroundingPrompt}

        СТРАТЕГИЯ:
        1. Идентифицируй точный MPN, Бренд и Модель.
        2. Собери все характеристики (Yield, Color, Chip).
        3. ПРОАНАЛИЗИРУЙ СОВМЕСТИМОСТЬ: Собери полный список принтеров.
        4. ГЕНЕРИРУЙ МАРКЕТИНГОВЫЙ КОНТЕНТ:
            - SEO Заголовок (H1): [Бренд] [Тип] для [Главные Принтеры] ([Цвет], [Ресурс])
            - Описание: Продающее HTML описание с ключевыми преимуществами.
            - Буллиты: 5 ключевых особенностей для маркетплейсов.
            - Ключевые слова: SEO теги для поиска.

        КРИТИЧЕСКИЕ ПРАВИЛА:
        1. Использовать данные из Текста И Ввода пользователя.
        2. 'brand', 'model', 'yield' - НЕ МОГУТ БЫТЬ NULL, если они есть во вводе.
        3. 'short_model': Извлечь короткий алиас (напр. "CF218A" -> "18A").
        4. 'faq': Извлечь 3-5 частых вопросов/проблем (напр. "Как сбросить чип?").
        5. 'related_ids': Список связанных расходников (барабаны, чипы).
        6. Маркетинг должен быть на РУССКОМ языке.

        Входной Текст:
        ${sources.join("\n\n")}
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

        try {
            const response = await BackendLLMService.complete({
                model: effectiveModel,
                profile: modelOverride ? undefined : ModelProfile.REASONING, // Use Smart/Reasoning model if no override
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Extract data according to StrictConsumableData schema." }
                ],
                jsonSchema: ConsumableDataSchema,
                routingStrategy: RoutingStrategy.SMART, // Reasoning requires balance
                apiKeys
            });

            const parsed = safeJsonParse(response || "{}");

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
