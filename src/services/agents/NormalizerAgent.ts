
import { ConsumableData } from "../../types/domain.js"; // We might need to define this strict type if not present
import { BackendLLMService } from "../backend/llm.js";
import { safeJsonParse } from "../../lib/json.js";

interface NormalizationRules {
    targetUnitSystem: 'metric';
    brandNormalization: boolean;
}

export class NormalizerAgent {
    static async normalize(data: any, onLog?: (msg: string) => void): Promise<any> {
        // 1. Heuristic Normalization (Fast, deterministic)
        // Convert Brands to Title Case
        if (data.brand) {
            data.brand = this.normalizeBrand(data.brand);
        }

        // 2. LLM-based Normalization for complex fields (Yield, Compatibility)
        // If yield is a string "15k pages", convert to { value: 15000, unit: "pages" }
        if (data.tech_specs?.yield && typeof data.tech_specs.yield === 'string') {
             // ... LLM or Regex call
             // For now, let's trust ExtractorAgent did a good job, but strict typing is key.
        }

        return data;
    }

    private static normalizeBrand(brand: string): string {
        const map: Record<string, string> = {
            'hp': 'HP',
            'hewlett packard': 'HP',
            'canon': 'Canon',
            'xerox': 'Xerox',
            'brother': 'Brother',
            'kyocera': 'Kyocera',
            'ricoh': 'Ricoh',
            'samsung': 'Samsung',
            'pantum': 'Pantum',
            'lexmark': 'Lexmark',
            'konica minolta': 'Konica Minolta',
            'oki': 'OKI'
        };
        return map[brand.toLowerCase()] || brand;
    }

    /**
     * SOTA: "Fuzzy Matcher" for Printer Compatibility
     * Normalizes "HP LaserJet Pro M402dne" -> "HP LaserJet Pro M402" series
     */
    static async normalizePrinterList(printers: string[], onLog?: (msg: string) => void): Promise<string[]> {
        if (!printers || printers.length === 0) return [];

        const systemPrompt = `You are a Printer Model Normalizer.
        Standardize the list of printer models.
        - Remove duplicate entries.
        - Use official naming conventions (e.g., "HP LaserJet Pro M402n" -> "HP LaserJet Pro M402n").
        - Group by series if legitimate (e.g. "M402 Series").
        
        Return JSON number array of indices to keep, or just the cleaned list string array.
        Return: { "normalized": ["Model 1", "Model 2"] }
        `;

        try {
            const response = await BackendLLMService.complete({
                model: "openrouter/auto",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify(printers.slice(0, 50)) } // Cap at 50
                ],
                jsonSchema: {
                    type: "object",
                    properties: {
                        normalized: { type: "array", items: { type: "string" } }
                    }
                }
            });
            const parsed = safeJsonParse(response || "{}");
            return parsed.normalized || printers;
        } catch (e) {
            console.warn("Printer normalization failed", e);
            return printers;
        }
    }
}
