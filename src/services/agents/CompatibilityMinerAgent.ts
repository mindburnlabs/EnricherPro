
import { BackendLLMService } from "../backend/llm.js";
import { GenericScraper } from "../backend/GenericScraper.js";

interface CompatibilityMiningResult {
    printers: string[];
    sourceUrl?: string;
    confidence?: number;
}

export class CompatibilityMinerAgent {
    
    /**
     * Mines for compatible printers for a given SKU string (e.g., "HP CF226X")
     */
    static async mine(skuString: string, onLog?: (msg: string) => void): Promise<CompatibilityMiningResult[]> {
        onLog?.(`[CompatibilityMiner] Starting mining for: ${skuString}`);

        // 1. Focused Search
        const queries = [
            `${skuString} compatible printers list`,
            `${skuString} printer compatibility chart`,
            `what printers use ${skuString}`
        ];

        // 2. We'll execute just the first query for MVP efficiency
        // Instantiate the scraper
        const scraper = new GenericScraper();
        const searchResults = await scraper.fetch(queries[0]);
        
        if (!searchResults || searchResults.length === 0) {
            onLog?.(`[CompatibilityMiner] No search results found.`);
            return [];
        }

        // 3. Select best candidate
        const bestCandidate = searchResults.find(r => 
            r.contentSnippet?.toLowerCase().includes('compatible') && 
            (r.contentSnippet?.toLowerCase().includes('list') || (r.contentSnippet?.length || 0) > 100)
        ) || searchResults[0];

        onLog?.(`[CompatibilityMiner] Analyzing content from: ${bestCandidate.url}`);

        // 4. Extraction via LLM
        const extractionPrompt = `
        You are a Data Extraction Specialist.
        Task: Extract a clean list of printer models compatible with the Consumable: "${skuString}".
        
        Source Context:
        ${(bestCandidate.contentSnippet || "").substring(0, 8000)}

        Output Format:
        Return ONLY a JSON object with a single key "printers" containing an array of strings.
        Example: { "printers": ["HP LaserJet Pro M402d", "HP LaserJet Pro M402dn"] }
        
        Rules:
        - Normalize model names (e.g., remove "HP" if it's obvious, but keeping it is safer).
        - Exclude derived series if specific models are listed (prefer "M402d", "M402dn" over just "M400 Series" if possible, otherwise accept series).
        - If no printers are found, return { "printers": [] }.
        `;

        try {
            const result = await BackendLLMService.complete({
                messages: [{ role: 'user', content: extractionPrompt }],
                model: 'openrouter/auto', // Use a fast model
                jsonSchema: {
                    type: "object",
                    properties: {
                        printers: { type: "array", items: { type: "string" } }
                    }
                }
            });

            const parsed = JSON.parse(result || '{"printers": []}');
            onLog?.(`[CompatibilityMiner] Extracted ${parsed.printers.length} printers.`);

            return [{
                printers: parsed.printers,
                sourceUrl: bestCandidate.url,
                confidence: 80 // Base confidence for extracted lists
            }];

        } catch (e) {
            onLog?.(`[CompatibilityMiner] Extraction failed: ${e}`);
            return [];
        }
    }
}
