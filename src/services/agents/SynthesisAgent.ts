
import { BackendLLMService } from "../backend/llm";
import { ConsumableData } from "../../types/domain";

export class SynthesisAgent {

    static async merge(sources: string[], schemaKey: string = "StrictConsumableData"): Promise<Partial<ConsumableData>> {
        const systemPrompt = `You are the Synthesis Agent for the EnricherPro Consumable Database.
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
        - confidence: 0.0 to 1.0 based on how clear the text was.
        
        Input Text:
        ${sources.join("\n\n")}
        `;

        try {
            const response = await BackendLLMService.complete({
                model: "google/gemini-2.0-flash-001",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Extract data according to StrictConsumableData schema." }
                ],
                jsonSchema: true
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
