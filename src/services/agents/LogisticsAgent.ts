import { BackendFirecrawlService } from "../backend/firecrawl.js";

export class LogisticsAgent {

    /**
     * NIX.ru Exclusive Logic
     * Searches for specifically "вес брутто" (gross weight) and dimensions.
     */
    static async checkNixRu(canonicalName: string, apiKeys?: Record<string, string>, onLog?: (msg: string) => void): Promise<{ weight: string | null, dimensions: string | null, url: string | null }> {
        const query = `site:nix.ru ${canonicalName} вес брутто`;

        try {
            const results = await BackendFirecrawlService.search(query, {
                limit: 1,
                formats: ['markdown'],
                apiKey: apiKeys?.firecrawl
            });

            if (onLog) onLog(`Checking NIX.ru for ${canonicalName}...`);

            if (results.length > 0) {
                const item = results[0];
                const text = item.markdown || "";

                // Simple Regex Extraction for NIX specific format
                // Example: "Вес брутто (измерено в НИКСе) 0.84 кг"
                const weightMatch = text.match(/Вес брутто.*?([\d\.]+)\s*кг/i);

                // Example: "Размеры упаковки (измерено в НИКСе) 35 x 15 x 10 см"
                const dimMatch = text.match(/Размеры упаковки.*?([\d\.\sx]+)\s*см/i);

                return {
                    weight: weightMatch ? `${weightMatch[1]} kg` : null,
                    dimensions: dimMatch ? `${dimMatch[1]} cm` : null,
                    url: item.url
                };
            }
        } catch (e) {
            console.error("Logistics Check Failed:", e);
        }

        return { weight: null, dimensions: null, url: null };
    }
}
