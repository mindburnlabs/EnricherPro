
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
    static async extractClaims(sourceText: string, sourceUrl: string, apiKeys?: Record<string, string>, promptOverride?: string): Promise<ExtractedClaim[]> {
        const systemPrompt = promptOverride || `You are an Extraction Engine.
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

        try {
            const response = await BackendLLMService.complete({
                profile: ModelProfile.EXTRACTION, // Use Cheap/Fast model
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

    static async merge(sources: string[], schemaKey: string = "StrictConsumableData", apiKeys?: Record<string, string>, promptOverride?: string, onLog?: (msg: string) => void): Promise<Partial<ConsumableData>> {
        onLog?.(`Synthesizing data from ${sources.length} sources...`);
        const systemPrompt = promptOverride || `You are the Synthesis Agent for the EnricherPro Consumable Database.
        Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.
        
        CRITICAL RULES (Evidence-First):
        1. ONLY output data explicitly present in the text. Do not guess.
        2. If a field is missing, leave it null.
        3. For 'compatible_printers_ru', look for lists of printer models.
        4. For 'logistics', look for "Package Weight" (вес упаковки) and "Dimensions" (габариты).
        5. 'mpn_identity.mpn' is the Manufacturer Part Number. It must be exact.
        6. PRIORITIZE data from NIX.ru for logistics (weight, dimensions).
        7. PRIORITIZE data from Official sources (hp.com, etc) for technical specs (yield, color).
        
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
        8. CONSENSUS SCORING: If you find the same data in >1 source, boost confidence of the merged value.
        
        Input Text:
        ${sources.join("\n\n")}
        `;

        try {
            const response = await BackendLLMService.complete({
                profile: ModelProfile.REASONING, // Use Smart/Reasoning model
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
