
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
    static async extractClaims(sourceText: string, sourceUrl: string, apiKeys?: Record<string, string>, promptOverride?: string, modelOverride?: string | { id: string }, language: string = 'en', screenshotUrl?: string): Promise<ExtractedClaim[]> {
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



        const systemPromptEn = promptOverride || `You are a Data Extraction Engine.
        Your goal is to parse the PROVIDED user text and extract structured facts (Claims).
        
        CRITICAL INSTRUCTION:
        - The input text is already provided by the user. You are NOT browsing the web.
        - You are NOT bypassing any CAPTCHAs. The text is already extracted.
        - Do NOT refuse to process the text.
        
        Targets:
        - mpn_identity.mpn, mpn_identity.series (e.g. "HP 12A")
        - brand
        - type_classification.family (toner, drum, ink...), type_classification.subtype (cartridge, bottle...)
        - yield.value, yield.unit, yield.standard (ISO_19752, etc.)
        - compatible_printers_ru (array of objects {model, canonicalName, is_ru_confirmed, constraints})
        - logistics: package_weight_g, width_mm, height_mm, depth_mm, origin_country, hs_code, box_contents
        - tech_specs: color, is_integrated_drum, chip_type (oem/compatible/universal)
        - gtin (array of strings)
        - aliases, cross_reference_mpns
        - faq (3-5 common questions/problems)
        
        Rules:
        1. Extract ONLY present data. No guessing.
        2. Normalize numeric values (e.g. "1 kg" -> 1000).
        3. Confidence 0.1-1.0 based on clarity.
        4. CRITICAL: For nested fields, use DOT NOTATION in 'field' property.
           - "mpn" -> "mpn_identity.mpn"
           - "series" -> "mpn_identity.series"
           - "chip" -> "tech_specs.chip_type"
           - "weight" -> "logistics.package_weight_g"
           - "yield" -> "tech_specs.yield.value"
        `;


        const systemPromptRu = `Вы - Движок Извлечения Данных.
        Ваша цель - проанализировать ПРЕДОСТАВЛЕННЫЙ текст и извлечь факты.

        ВАЖНО:
        - Текст уже предоставлен пользователем. Вы НЕ просматриваете интернет.
        - Вы НЕ обходите CAPTCHA.
        - НЕ отказывайтесь обрабатывать текст.
        
        Цели:
        - mpn_identity.mpn, mpn_identity.series (напр. "HP 12A")
        - brand
        - type_classification.family (toner, drum...), type_classification.subtype
        - yield.value, yield.unit, yield.standard (ISO/IEC)
        - compatible_printers_ru (объекты: model, canonicalName, is_ru_confirmed, constraints)
        - compliance_ru: tn_ved_code (8443...), mandatory_marking (Честный ЗНАК?), certification_type (refusal_letter?), has_sds
        - logistics: package_weight_g, width_mm, height_mm, depth_mm, origin_country, box_contents (gloves, chip...), transport_symbols
        - tech_specs: color, is_integrated_drum, chip_type (oem/compatible/universal)
        - gtin, aliases
        - faq (3-5 частых вопросов: прошивка, чип, сброс)
        
        Правила:
        1. Извлекать ТОЛЬКО присутствующие данные.
        2. Нормализовать числа (1 кг -> 1000).
        3. ИСПОЛЬЗОВАТЬ ТОЧКУ для вложенных полей:
           - 'compliance_ru.tn_ved_code'
           - 'compliance_ru.mandatory_marking'
           - 'tech_specs.yield.value'
           - 'logistics.package_weight_g'
           - 'mpn_identity.mpn'
           - 'tech_specs.chip_type'
        4. Уверенность (confidence) 0.1-1.0.
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

        try {
            const response = await BackendLLMService.complete({
                model: effectiveModel,
                profile: modelOverride ? undefined : ModelProfile.EXTRACTION, // Use Cheap/Fast model if no override
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: screenshotUrl
                            ? [
                                { type: "text", text: `Source URL: ${sourceUrl}\n\n${sourceText.substring(0, 15000)}` },
                                { type: "image_url", image_url: { url: screenshotUrl } }
                            ]
                            : `Source URL: ${sourceUrl}\n\n${sourceText.substring(0, 15000)}`
                    }
                ],
                jsonSchema: ExtractionSchema,
                routingStrategy: RoutingStrategy.FAST, // Extraction is high volume
                apiKeys
            });

            const parsed = safeJsonParse<any>(response || "[]", []);
            return Array.isArray(parsed) ? parsed : (parsed.claims || []);
        } catch (error: any) {
            // Fallback: If model rejects image (404/400 support error), try TEXT ONLY
            if (screenshotUrl && error.message?.includes("support image input")) {
                console.warn(`[SynthesisAgent] Model ${effectiveModel} rejected image. Retrying text-only...`);
                try {
                    const response = await BackendLLMService.complete({
                        model: effectiveModel,
                        profile: modelOverride ? undefined : ModelProfile.EXTRACTION,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: `Source URL: ${sourceUrl}\n\n${sourceText.substring(0, 15000)}` }
                        ],
                        jsonSchema: ExtractionSchema,
                        routingStrategy: RoutingStrategy.FAST,
                        apiKeys
                    });
                    const parsed = safeJsonParse<any>(response || "[]", []);
                    return Array.isArray(parsed) ? parsed : (parsed.claims || []);
                } catch (retryError) {
                    console.error(`Extraction failed (retry) for ${sourceUrl}:`, retryError);
                    return [];
                }
            }

            console.error(`Extraction failed for ${sourceUrl}:`, error);
            return [];
        }
    }

    static async merge(
        sources: string[],
        schemaKey: string = "StrictConsumableData",
        apiKeys?: Record<string, string>,
        promptOverride?: string,
        onLog?: (msg: string) => void,
        modelOverride?: string | { id: string },
        language: string = 'en',
        originalInput?: string,
        onProgress?: (partial: Partial<ConsumableData>, chunkIndex: number, totalChunks: number) => void
    ): Promise<Partial<ConsumableData>> {
        onLog?.(`Synthesizing data from ${sources.length} sources...`);

        // SLIDING WINDOW BATCHING (Perplexity-Grade Scale)
        // Process in chunks of 15 to avoid context limits and hallucinations
        const CHUNK_SIZE = 15;
        const chunks: string[][] = [];
        for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
            chunks.push(sources.slice(i, i + CHUNK_SIZE));
        }

        onLog?.(`Split ${sources.length} sources into ${chunks.length} parallel processing chunks.`);

        // STREAMING UPGRADE: Process chunks and emit partial results
        const chunkResults: Partial<ConsumableData>[] = [];

        // Process chunks in parallel (Swarm) but emit progress as each completes
        await Promise.all(chunks.map(async (chunk, index) => {
            onLog?.(`[Swarm] Processing Chunk ${index + 1}/${chunks.length}...`);
            const result = await this.processChunk(chunk, apiKeys, promptOverride, modelOverride, language, originalInput);
            chunkResults[index] = result;

            // STREAMING: Emit partial result for progressive UI
            if (onProgress) {
                // Merge results accumulated so far for preview
                const accumulated = this.mergePartials(chunkResults.filter(Boolean));
                onProgress(accumulated, index + 1, chunks.length);
            }

            return result;
        }));

        // Final Consensus/Merge of Chunk Results
        if (chunkResults.length === 1) {
            return chunkResults[0];
        } else {
            onLog?.(`[Swarm] Merging ${chunkResults.length} chunk results into Final Truth...`);
            return this.consensusMerge(chunkResults, apiKeys, modelOverride, language);
        }
    }

    /**
     * Simple client-side merge of partial results for streaming preview
     * (Less sophisticated than consensusMerge, but fast)
     */
    private static mergePartials(partials: Partial<ConsumableData>[]): Partial<ConsumableData> {
        if (partials.length === 0) return {};
        if (partials.length === 1) return partials[0];

        // Simple shallow merge - later results override earlier ones
        const merged: any = {};
        for (const partial of partials) {
            for (const [key, value] of Object.entries(partial)) {
                if (value !== null && value !== undefined) {
                    // For arrays, concat and dedupe
                    if (Array.isArray(value) && Array.isArray(merged[key])) {
                        merged[key] = [...new Set([...merged[key], ...value])];
                    } else if (typeof value === 'object' && typeof merged[key] === 'object' && !Array.isArray(value)) {
                        // Deep merge objects
                        merged[key] = { ...merged[key], ...value };
                    } else {
                        merged[key] = value;
                    }
                }
            }
        }
        return merged;
    }

    private static async processChunk(sources: string[], apiKeys?: Record<string, string>, promptOverride?: string, modelOverride?: string | { id: string }, language: string = 'en', originalInput?: string): Promise<Partial<ConsumableData>> {
        const isRu = language === 'ru';
        const { useSettingsStore } = await import('../../stores/settingsStore.js');
        const state = useSettingsStore.getState();
        const storeModel = state.reasoningModel;
        let effectiveModel = (typeof modelOverride === 'string' ? modelOverride : modelOverride?.id) || storeModel;

        if (!effectiveModel) {
            effectiveModel = 'google/gemini-2.0-flash-exp:free';
        }

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

        const systemPromptRu = `Вы - Агент Синтеза D² (Swarm Worker).
        Ваша миссия - извлечь ЧИСТЫЕ данные из этого пакета источников.

        ${inputGroundingPrompt}

        СТРАТЕГИЯ:
        1. Идентифицируй точный MPN, Бренд и Модель.
        2. Собери все характеристики (Yield, Color, Chip).
        3. ПРОАНАЛИЗИРУЙ СОВМЕСТИМОСТЬ: Собери полный список принтеров.
        4. ГЕНЕРИРУЙ МАРКЕТИНГОВЫЙ КОНТЕНТ (РУССКИЙ).

        КРИТИЧЕСКИЕ ПРАВИЛА:
        1. Извлекать ТОЛЬКО присутствующие данные.
        2. ИСПОЛЬЗОВАТЬ ТОЧКУ для вложенных полей.
        3. Нормализация полей:
           - compatibility_ru: Ищите упоминания о прошивках, чипах, регионах.
           - compliance_ru: ТН ВЭД, Честный ЗНАК.
           - logistics: Вес, габариты, комплектация.

        Входной Текст (Пакет):
        ${sources.join("\n\n")}
        `;

        const systemPrompt = isRu ? systemPromptRu : systemPromptEn;

        try {
            const response = await BackendLLMService.complete({
                model: effectiveModel,
                profile: modelOverride ? undefined : ModelProfile.REASONING,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Extract data according to StrictConsumableData schema." }
                ],
                jsonSchema: ConsumableDataSchema,
                routingStrategy: RoutingStrategy.SMART,
                apiKeys
            });

            const parsed = safeJsonParse<any>(response || "{}", {});
            return this.normalizeData(parsed);
        } catch (error) {
            console.error("SynthesisAgent Chunk Failed:", error);
            return {};
        }
    }

    private static normalizeData(data: any): any {
        if (!data) return data;

        // Yield Normalization
        if (data.tech_specs?.yield) {
            const y = data.tech_specs.yield;

            // Standard Normalization
            if (typeof y.standard === 'string') {
                const s = y.standard.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (s.includes('19752')) y.standard = 'ISO_19752';
                else if (s.includes('19798')) y.standard = 'ISO_19798';
                else if (s.includes('24711')) y.standard = 'ISO_24711'; // Ink
                else if (s.includes('5') && (s.includes('cov') || s.includes('percent'))) y.standard = '5_percent_coverage';
                else if (s.includes('manuf') || s.includes('declar')) y.standard = 'manufacturer_stated';
            }

            // Unit Normalization
            if (typeof y.unit === 'string') {
                const u = y.unit.toLowerCase();
                if (u.includes('pag') || u.includes('cop') || u.includes('sheet')) y.unit = 'pages';
                else if (u.includes('ml')) y.unit = 'ml';
                else if (u.includes('g') || u.includes('gram')) y.unit = 'g';
            }
        }

        // GTIN Normalization
        if (data.gtin) {
            if (typeof data.gtin === 'string') {
                data.gtin = [data.gtin];
            } else if (!Array.isArray(data.gtin)) {
                // If it's something else weird (number, null, etc), allow empty or stringify?
                // Safest is to force array or empty
                data.gtin = [];
            }
        }

        return data;
    }

    /**
     * SOTA 2026: Consensus Merge with Domain Trust Scoring
     * Uses a tiered trust system to weight sources during conflict resolution.
     * 
     * DOMAIN TRUST LEVELS:
     * - OEM (hp.com, canon.com): 100 - Manufacturer is ground truth
     * - Verified Retailers (nix.ru, dns-shop.ru): 85-90
     * - General Retailers (ozon.ru, wildberries.ru): 70
     * - OEM China (alibaba.com, 1688.com): 50
     * - Unknown sources: 30
     */
    private static async consensusMerge(results: Partial<ConsumableData>[], apiKeys?: Record<string, string>, modelOverride?: string | { id: string }, language: string = 'en'): Promise<Partial<ConsumableData>> {
        // DeepSeek R1 Verification Step
        // We take the N chunk results and ask the LLM to merge them into one Final Truth

        const isRu = language === 'ru';
        const { useSettingsStore } = await import('../../stores/settingsStore.js');
        const state = useSettingsStore.getState();
        const storeModel = state.reasoningModel;
        let effectiveModel = (typeof modelOverride === 'string' ? modelOverride : modelOverride?.id) || storeModel;
        if (!effectiveModel) effectiveModel = 'google/gemini-2.0-flash-exp:free';

        const mergedJson = JSON.stringify(results, null, 2);

        // SOTA 2026: Domain Trust Scoring System
        const domainTrustGuide = `
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
        `;

        const confidenceProtocol = `
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
            "compatible_printers": "high",
            "logistics": "low"
        }
        
        Include "_uncertainty_reasons" for any medium/low fields:
        "_uncertainty_reasons": {
            "yield": "Only found in one retailer listing",
            "logistics": "Weight differs between sources (500g vs 520g)"
        }
        ═══════════════════════════════════════════════════════════════════════════════
        `;

        const systemPrompt = isRu ? `
         Вы - Агент Истины (DeepSeek Consensus) с Доменным Доверием (SOTA 2026).
         У вас есть ${results.length} частичных результатов анализа одного товара.
         Ваша цель: Объединить их в один ИДЕАЛЬНЫЙ JSON, учитывая авторитетность источников.

         ${domainTrustGuide}

         ${confidenceProtocol}

         Правила арбитража:
         1. Конфликты MPN? Предпочитай OEM источники (hp.com, canon.com), затем по частоте.
         2. Совместимость: ОБЪЕДИНИТЬ списки принтеров (убрать дубликаты). OEM данные приоритетнее.
         3. Логистика: Предпочитай данные от ритейлеров Tier B (они реально измеряют).
         4. RU Compliance: Если где-то найден ТН ВЭД или Честный ЗНАК - сохрани это.
         5. FAQ: Выбери 5 самых полезных вопросов из всех.
         6. ОБЯЗАТЕЛЬНО включи _confidence_map и _uncertainty_reasons.
         
         Входные данные:
         ${mergedJson}
         ` : `
         You are the Truth Arbitration Agent with Domain Trust Scoring (SOTA 2026).
         You have ${results.length} partial extraction results.
         Merge them into one PERFECT JSON, weighting by source authority.
         
         ${domainTrustGuide}

         ${confidenceProtocol}
         
         Rules:
         1. Resolve conflicts by Domain Trust Score (Tier A beats all others).
         2. Merge compatibility lists (deduplicate). OEM data takes precedence.
         3. For logistics, prefer Tier B retailers (they measure actual packages).
         4. Keep the most detailed specs from highest-trust sources.
         5. MUST include _confidence_map and _uncertainty_reasons in output.
         `;

        const response = await BackendLLMService.complete({
            model: effectiveModel, // Ideally DeepSeek-R1 here
            profile: ModelProfile.PLANNING, // High intelligence
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Merge into StrictConsumableData with confidence tracking." }
            ],
            jsonSchema: ConsumableDataSchema,
            routingStrategy: RoutingStrategy.SMART,
            apiKeys
        });

        const parsed = safeJsonParse<any>(response || "{}", {});
        const normalized = this.normalizeData(parsed);

        // Post-processing timestamps & POLYFILL FOR LEGACY UI
        if (normalized) {
            const now = new Date().toISOString();

            // 1. Evidence Timestamps
            if (parsed._evidence) {
                for (const key of Object.keys(parsed._evidence)) {
                    if (parsed._evidence[key]) {
                        parsed._evidence[key].timestamp = now;
                    }
                }
            }

            // 2. BACKWARD COMPATIBILITY POLYFILL (Strict Truth -> Legacy UI)
            // Use "as any" to write to deprecated readonly fields if necessary
            const p = normalized as any;

            // Yield
            if (!p.yield && p.tech_specs?.yield) {
                p.yield = p.tech_specs.yield;
            }

            // Color
            if (!p.color && p.tech_specs?.color) {
                p.color = p.tech_specs.color;
            }

            // Consumable Type (Family)
            if (!p.consumable_type && p.type_classification?.family) {
                p.consumable_type = p.type_classification.family;
            }

            // Weights/Dims (Logistics)
            if (p.logistics) {
                if (p.logistics.package_weight_g && !p.weight_g) p.weight_g = p.logistics.package_weight_g;
                // Add other legacy fields if needed
            }
        }

        return normalized;
    }
}
