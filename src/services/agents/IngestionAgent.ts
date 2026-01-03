import { BackendLLMService, RoutingStrategy } from "../backend/llm.js";
import { safeJsonParse } from "../../lib/json.js";
import { GraphService } from "../backend/GraphService.js";
import { items, skuAliases } from "../../db/schema.js"; // Import schema for reference or types
import { ModelProfile } from "../../config/models.js";

interface CatalogItem {
    mpn: string;
    alias?: string;
    title: string;
    url: string;
    price?: string;
    stock?: boolean;
}

export class IngestionAgent {

    /**
     * Parses a raw HTML/Markdown of a Catalog Page (List of items) into structured items.
     * Use Tier A (Fast/Cheap) model.
     */
    static async parseCatalog(datasetRaw: string, sourceDomain: string): Promise<CatalogItem[]> {
        const systemPrompt = `You are a Catalog Ingestion Engine.
        Your goal is to extract a list of products from a retailer category page.
        
        Source: ${sourceDomain}
        
        Extract:
        - MPN (Manufacturer Part Number) - CRITICAL. If missing, leave empty.
        - Title (Full Product Name)
        - Price (if visible)
        - URL (Product Detail Link)
        
        Return JSON Array:
        [
            { "mpn": "Q2612A", "title": "HP 12A Black Toner", "url": "/p/hp-12a", "price": "50 USD" }
        ]
        `;

        try {
            // Tier A: Fast/Cheap
            const response = await BackendLLMService.complete({
                profile: ModelProfile.FAST_CHEAP,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Extract items from this markdown:\n${datasetRaw.substring(0, 30000)}` } // Cap context
                ],
                jsonSchema: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            mpn: { type: "string" },
                            title: { type: "string" },
                            url: { type: "string" },
                            price: { type: "string" }
                        },
                        required: ["title", "url"]
                    }
                },
                routingStrategy: RoutingStrategy.CHEAP
            });

            return safeJsonParse(response || "[]");

        } catch (e) {
            console.error("IngestionAgent failed", e);
            return [];
        }
    }

    /**
     * Processes extracted items:
     * 1. Writes MPN aliases to Graph.
     * 2. (Optional) Enqueues full enrichment.
     */
    static async processItems(items: CatalogItem[], source: string) {
        let count = 0;
        for (const item of items) {
            if (item.mpn) {
                // Link Title -> MPN as alias
                // e.g. "HP 12A Black Toner" -> "Q2612A"
                // Extract simple alias from title?

                // Write to Graph
                await GraphService.linkAlias(item.title, item.mpn, "Unknown", source);

                // Also link explicit Alias if MPN is different?
                // For now, relies on Title.

                count++;
            }
        }
        return count;
    }
}
