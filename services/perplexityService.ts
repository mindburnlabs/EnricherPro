import { createOpenRouterService } from './openRouterService';
import { apiIntegrationService } from './apiIntegrationService';

export interface PerplexitySearchOptions {
    recency?: 'month' | 'week' | 'day' | 'year';
}

export class PerplexityService {
    private static instance: PerplexityService;

    private constructor() { }

    public static getInstance(): PerplexityService {
        if (!PerplexityService.instance) {
            PerplexityService.instance = new PerplexityService();
        }
        return PerplexityService.instance;
    }

    /**
     * Discover many RU sources fast using Perplexity Sonar via OpenRouter.
     * This corresponds to the "Search vs Scrape" split - Step 1: Search.
     */
    async discoverSources(query: string, options: PerplexitySearchOptions = {}): Promise<{ urls: string[], summary: string, raw_response: any }> {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';
        if (!apiKey) throw new Error('OpenRouter API key missing for Perplexity Service');

        // Use specific Sonar model optimized for search
        const openRouter = createOpenRouterService({
            apiKey,
            model: 'perplexity/sonar-reasoning', // or 'perplexity/sonar'
            temperature: 0.1
        });

        const prompt = `
      Find comprehensive sources for printer consumable: "${query}".
      
      TARGETS:
      1. Official Manufacturer Pages (HP, Canon, Xerox, etc.)
      2. Major Russian Retailers (citilink.ru, dns-shop.ru, onlinetrade.ru)
      3. Specialized RU Consumable Stores (cartridge.ru, rashodnika.net, nvprint.ru)
      4. NIX.ru or equivalent catalog specifications
      
      OUTPUT FORMAT:
      Return a JSON object with:
      - "summary": A brief tactical summary of availability and market presence.
      - "sources": An array of high-value URLs found.
      
      Focus on finding the EXACT MPN match.
    `;

        try {
            // leveraging the raw completion request from OpenRouterService would be ideal, 
            // but for now we can simulate a "research" call or make a direct completion.
            // Since OpenRouterService exposes synthesis methods, let's make a direct call using apiIntegrationService 
            // similar to how OpenRouterService does it, or extend OpenRouterService.
            // For cleanliness, we'll implement a focused call here using the ApiIntegrationService directly 
            // but re-using the OpenRouter infrastructure.

            // Actually, let's just reuse the underlying fetch logic or `openRouter.makeCompletionRequest` if it was public.
            // It is private. Let's make a specialized request here.

            const response = await apiIntegrationService.makeRequest(
                {
                    serviceId: 'perplexity',
                    operation: 'discoverSources',
                    priority: 'high',
                    retryable: true,
                    metadata: { query }
                },
                async () => {
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': 'https://enricherpro.com',
                            'X-Title': 'Consumable Enricher Pro'
                        },
                        body: JSON.stringify({
                            model: 'perplexity/sonar-reasoning', // Good balance of reasoning + search
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.1
                        })
                    });

                    if (!res.ok) throw new Error(`Perplexity API failed: ${res.status}`);
                    return { success: true, data: await res.json(), responseTime: 0 };
                }
            );

            const content = response.data.choices?.[0]?.message?.content || '{}';
            let parsed;
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
            } catch (e) {
                parsed = { summary: content, sources: [] };
            }

            // Extract details
            const urls: string[] = parsed.sources || [];
            // Also try to grab citations if available in the raw response metadata from Sonar
            if (response.data.citations) {
                urls.push(...response.data.citations);
            }

            return {
                urls: Array.from(new Set(urls)),
                summary: parsed.summary || "No summary provided",
                raw_response: response.data
            };

        } catch (error) {
            console.error('Perplexity discovery failed:', error);
            return { urls: [], summary: "Discovery failed", raw_response: null };
        }
    }
}

export const perplexityService = PerplexityService.getInstance();
