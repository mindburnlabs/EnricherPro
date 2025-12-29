import { createOpenRouterService } from './openRouterService';
import { apiIntegrationService } from './apiIntegrationService';

export interface PerplexitySearchOptions {
    recency?: 'month' | 'week' | 'day' | 'year';
}

// Configuration interface for Perplexity
export interface PerplexityConfig {
    provider: 'openrouter' | 'direct';
    apiKey: string; // Required if provider is 'direct'
    model: string; // e.g., 'sonar', 'sonar-pro', 'sonar-reasoning'
}

export const DEFAULT_PERPLEXITY_CONFIG: PerplexityConfig = {
    provider: 'openrouter',
    apiKey: '',
    model: 'perplexity/sonar-deep-research' // SOTA Deep Research
};

// Direct Perplexity Models map to OpenRouter IDs or distinct IDs
export const PERPLEXITY_MODELS = {
    'sonar-deep-research': 'sonar-deep-research',
    'sonar-reasoning-pro': 'sonar-reasoning-pro',
    'sonar-reasoning': 'sonar-reasoning',
    'sonar-pro': 'sonar-pro',
    'sonar': 'sonar'
};

export class PerplexityService {
    private static instance: PerplexityService;
    private config: PerplexityConfig;

    private constructor() {
        this.config = this.loadConfig();
    }

    public static getInstance(): PerplexityService {
        if (!PerplexityService.instance) {
            PerplexityService.instance = new PerplexityService();
        }
        return PerplexityService.instance;
    }

    private loadConfig(): PerplexityConfig {
        if (typeof localStorage === 'undefined') {
            return DEFAULT_PERPLEXITY_CONFIG;
        }
        const saved = localStorage.getItem('perplexity_config');
        if (saved) {
            try {
                return { ...DEFAULT_PERPLEXITY_CONFIG, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Failed to parse Perplexity config", e);
            }
        }
        return DEFAULT_PERPLEXITY_CONFIG;
    }

    public updateConfig(newConfig: Partial<PerplexityConfig>) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem('perplexity_config', JSON.stringify(this.config));
    }

    public getConfig(): PerplexityConfig {
        return this.config;
    }

    /**
     * Discover many RU sources fast.
     * Uses either OpenRouter or Direct Perplexity API based on config.
     */
    async discoverSources(query: string, options: PerplexitySearchOptions = {}): Promise<{ urls: string[], summary: string, raw_response: any }> {
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

        if (this.config.provider === 'direct') {
            return this.discoverSourcesDirect(prompt);
        } else {
            return this.discoverSourcesOpenRouter(prompt);
        }
    }

    private async discoverSourcesDirect(prompt: string): Promise<{ urls: string[], summary: string, raw_response: any }> {
        if (!this.config.apiKey) throw new Error("Perplexity Direct API Key is missing");

        // Perplexity Native API Endpoint
        // Model names in direct API might differ slightly, usually 'sonar-reasoning' etc.
        // We map the configured model to the direct model ID if needed.
        // For now assume the user selects a valid direct model ID.
        const model = this.config.model.replace('perplexity/', ''); // Strip 'perplexity/' if it was set from OpenRouter list

        try {
            const response = await apiIntegrationService.makeRequest(
                {
                    serviceId: 'perplexity-direct',
                    operation: 'discoverSources',
                    priority: 'high',
                    retryable: true,
                    metadata: { model }
                },
                async () => {
                    const res = await fetch('https://api.perplexity.ai/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.config.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.1
                        })
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(`Perplexity Direct API failed: ${res.status} - ${err.error?.message || res.statusText}`);
                    }
                    return { success: true, data: await res.json(), responseTime: 0 };
                }
            );

            if (!response.success) {
                throw new Error(response.error || 'Perplexity Direct API request failed.');
            }

            return this.parseResponse(response.data);
        } catch (error) {
            console.error('Perplexity Direct discovery failed:', error);
            throw error;
        }
    }

    private async discoverSourcesOpenRouter(prompt: string): Promise<{ urls: string[], summary: string, raw_response: any }> {
        const apiKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
        if (!apiKey) throw new Error('OpenRouter API key missing for Perplexity Service');

        // Use configured model or fallback
        const model = this.config.model.startsWith('perplexity/') ? this.config.model : `perplexity/${this.config.model}`;

        try {
            const response = await apiIntegrationService.makeRequest(
                {
                    serviceId: 'perplexity-openrouter',
                    operation: 'discoverSources',
                    priority: 'high',
                    retryable: true,
                    metadata: { model }
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
                            model: model,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.1
                        })
                    });

                    if (!res.ok) throw new Error(`Perplexity (OpenRouter) API failed: ${res.status}`);
                    return { success: true, data: await res.json(), responseTime: 0 };
                }
            );

            if (!response.success) {
                throw new Error(response.error || 'Perplexity (OpenRouter) request failed.');
            }

            return this.parseResponse(response.data);

        } catch (error) {
            console.error('Perplexity discovery failed:', error);
            return { urls: [], summary: "Discovery failed", raw_response: null };
        }
    }

    private parseResponse(data: any): { urls: string[], summary: string, raw_response: any } {
        const content = data.choices?.[0]?.message?.content || '{}';
        let parsed;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
        } catch (e) {
            parsed = { summary: content, sources: [] };
        }

        const urls: string[] = parsed.sources || [];
        if (data.citations) {
            urls.push(...data.citations);
        }

        return {
            urls: Array.from(new Set(urls)),
            summary: parsed.summary || "No summary provided",
            raw_response: data
        };
    }
}

export const perplexityService = PerplexityService.getInstance();
