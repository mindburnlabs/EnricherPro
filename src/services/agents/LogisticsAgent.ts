
import { BackendFirecrawlService } from "../backend/firecrawl.js";
import { BackendLLMService } from "../backend/llm.js";
import { ModelProfile } from "../../config/models.js";
import { LogisticsSchema } from "../../schemas/agent_schemas.js";
import { RoutingStrategy } from "../backend/llm.js";

export class LogisticsAgent {

    /**
     * NIX.ru Specialized Scraper & Parser (No-API)
     * Scans NIX.ru for comprehensive data: Logistics, Specs, Compatibility.
     */
    static async checkNixRu(
        canonicalName: string,
        apiKeys?: Record<string, string>,
        onLog?: (msg: string) => void,
        promptOverride?: string,
        modelOverride?: string,
        language: string = 'en'
    ): Promise<{ weight: string | null, dimensions: string | null, url: string | null, fullExtract?: any }> {
        // Broad search to find the specific product page
        // If RU, explicit Russian query
        const suffix = language === 'ru' ? 'характеристики' : 'specs';
        const queries = [
            `site:nix.ru ${canonicalName} ${suffix}`,
            `site:nix.ru ${canonicalName} описание`
        ];

        try {
            let bestPage = null;

            for (const query of queries) {
                try {
                    const results = await BackendFirecrawlService.search(query, {
                        limit: 1,
                        formats: ['markdown'],
                        apiKey: apiKeys?.firecrawl
                    });
                    if (results.length > 0) {
                        bestPage = results[0];
                        break;
                    }
                } catch (e: any) {
                    if (e.message?.includes("Missing Firecrawl API Key") || e.statusCode === 402 || e.statusCode === 429) {
                        // Fallback to OpenRouter
                        const { FallbackSearchService } = await import("../backend/fallback.js");
                        const results = await FallbackSearchService.search(query, apiKeys);
                        if (results.length > 0) {
                            bestPage = results[0];
                            break;
                        }
                    }
                }
            }

            if (bestPage) {
                if (onLog) onLog(`Found NIX.ru page: ${bestPage.url}`);
                const text = bestPage.markdown || "";

                // Use Cheap LLM to parse NIX.ru's specific table format
                // They often have "Характеристики" (Specs) and "Совместимость" (Compatibility) blocks

                const systemPromptEn = `You are a NIX.ru Data Extractor, expert in parsing Russian technical specs.
                Extract the following from the text:
                1. "Вес брутто" (Gross Weight) -> normalized to kg.
                2. "Размеры упаковки" (Dimensions) -> normalized to cm (W x D x H).
                3. "Совместимость" (Compatibility) -> list of printer models.
                4. "Ресурс" (Yield) -> pages.
                
                Return JSON with keys: logistics.weight, logistics.dimensions, compatibility, specs.yield.
                `;

                const systemPromptRu = `Вы - Эксперт по извлечению данных с NIX.ru.
                Ваша задача - найти технические характеристики в тексте.
                
                ИЗВЛЕЧЬ:
                1. "Вес брутто" (Gross Weight) -> перевести в кг (например "0.85 кг").
                2. "Размеры упаковки" (Dimensions) -> перевести в см (например "30 x 10 x 10 см").
                3. "Совместимость" -> массив моделей принтеров.
                4. "Ресурс" -> количество страниц.

                Вернуть JSON:
                {
                    "logistics": { "weight": "...", "dimensions": "..." },
                    "compatibility": [...],
                    "specs": { "yield": "..." }
                }
                `;

                const systemPrompt = promptOverride || (language === 'ru' ? systemPromptRu : systemPromptEn);

                // Resolve model
                const { useSettingsStore } = await import('../../stores/settingsStore.js');
                const storeModel = useSettingsStore.getState().extractionModel;
                const targetModel = modelOverride || storeModel || 'openrouter/auto';

                const extract = await BackendLLMService.complete({
                    model: targetModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: text.substring(0, 20000) } // NIX pages can be long
                    ],
                    jsonSchema: LogisticsSchema,
                    apiKeys
                });

                const { safeJsonParse } = await import('../../lib/json.js');
                const parsed = safeJsonParse<any>(extract || "{}", {});

                return {
                    weight: parsed.logistics?.weight || null,
                    dimensions: parsed.logistics?.dimensions || null,
                    url: bestPage.url,
                    fullExtract: parsed
                };
            }
        } catch (e) {
            console.error("NIX.ru Check Failed:", e);
        }

        return { weight: null, dimensions: null, url: null };
    }
}

