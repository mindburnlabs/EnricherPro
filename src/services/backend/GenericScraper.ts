
import { SourceAdapter, SourceResult } from "../../lib/sources/SourceAdapter.js";
import { BackendLLMService, RoutingStrategy } from "../backend/llm.js";
import { safeJsonParse } from "../../lib/json.js";

/**
 * Generic Scraper Adapter
 * Uses OpenRouter's "Web" plugin to perform Google searches and extract snippets.
 * This simulates a "Firecrawl /crawl" or "/search" capability without needing a separate API key if running via OpenRouter.
 */
export class GenericScraper implements SourceAdapter {
    name = "GenericWebScraper";
    sourceType: 'generic' = 'generic';
    priority = 10; // Low priority compared to official/marketplaces, but good fallback

    async validate(url: string): Promise<boolean> {
        return true; // Accepts any query
    }

    async fetch(query: string): Promise<SourceResult[]> {
        const systemPrompt = `You are a Search Engine Wrapper.
        Perform a search for the user's query and return the results as a clean JSON array.
        
        Return format:
        {
            "results": [
                { "title": "...", "url": "...", "snippet": "..." }
            ]
        }
        `;

        try {
            // Use Fast Model with Web Plugin
            const response = await BackendLLMService.complete({
                model: "openrouter/auto", // Will resolve to a free/nitro model
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: query }
                ],
                plugins: [{ id: "web", max_results: 5 }],
                routingStrategy: RoutingStrategy.FAST,
                jsonSchema: {
                    type: "object",
                    properties: {
                        results: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    url: { type: "string" },
                                    snippet: { type: "string" }
                                },
                                required: ["title", "url", "snippet"]
                            }
                        }
                    }
                }
            });

            const parsed = safeJsonParse(response || "{}");
            const rawResults = parsed.results || [];

            return rawResults.map((r: any) => ({
                url: r.url,
                contentSnippet: r.snippet,
                // Simple hash of url for now
                contentHash: Buffer.from(r.url).toString('base64'), 
                priorityScore: 50, // Default neutrality
                metadata: { title: r.title, source: 'generic_web' }
            }));

        } catch (error) {
            console.error("GenericScraper failed:", error);
            return [];
        }
    }
}
