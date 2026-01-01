
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

        // CIRCUIT BREAKER for known broken models
        let effectiveModel = typeof modelOverride === 'string' ? modelOverride : modelOverride?.id;
        if (effectiveModel === 'xiaomi/mimo-v2-flash:free') {
            effectiveModel = 'google/gemini-2.0-flash-exp:free';
        }

        const systemPromptEn = promptOverride || `You are an Extraction Engine.
        Your goal is to parse the input text and extract structured facts (Claims) about a printer consumable.
        
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
        Ваша цель - проанализировать текст и извлечь структурированные факты (Claims).
        
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

    static async merge(sources: string[], schemaKey: string = "StrictConsumableData", apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void, modelOverride?: string | { id: string }, language: string = 'en'): Promise<Partial<ConsumableData>> {
        onLog?.(`Synthesizing data from ${sources.length} sources...`);

        const isRu = language === 'ru';

        // CIRCUIT BREAKER for known broken models
        let effectiveModel = typeof modelOverride === 'string' ? modelOverride : modelOverride?.id;
        if (effectiveModel === 'xiaomi/mimo-v2-flash:free') {
            effectiveModel = 'google/gemini-2.0-flash-exp:free';
        }

        const systemPromptEn = promptOverride || `You are the Synthesis Agent for the D² Consumable Database.
        Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.
        
        CRITICAL RULES (Evidence-First):
        1. ONLY output data explicitly present in the text. Do not guess.
        2. If a field is missing, leave it null.
        3. 'mpn_identity.mpn' is the Manufacturer Part Number. It must be exact.
        
        4. PRIORITIZE data from NIX.ru for logistics (weight, dimensions).
        5. PRIORITIZE data from Official sources (hp.com, etc) for technical specs (yield, color).
        
        You must populate the '_evidence' object for every extracted field.
        Input Text:
        ${sources.join("\n\n")}
        `;

        const systemPromptRu = `Вы - Агент Синтеза для Базы Данных Расходных Материалов D².
        Ваша миссия - извлечь ЧИСТЫЕ, ПРОВЕРЕННЫЕ данные из предоставленных текстов.
        
        КРИТИЧЕСКИЕ ПРАВИЛА (Доказательства превыше всего):
        1. Извлекать ТОЛЬКО данные, явно присутствующие в тексте. Не угадывать.
        2. Если поле отсутствует, оставить его null.
        3. 'mpn_identity.mpn' - это Артикул производителя (Part Number). Он должен быть точным.
        
        4. ПРИОРИТЕТ NIX.ru для логистики (вес, габариты).
        5. ПРИОРИТЕТ Официальным сайтам (HP, и т.д.) для тех. характеристик (ресурс, цвет).
        
        Вы должны заполнить объект '_evidence' для каждого извлеченного поля.
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
