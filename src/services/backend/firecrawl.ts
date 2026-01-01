
import FirecrawlApp from '@mendable/firecrawl-js';

// Server-side only client
export class BackendFirecrawlService {
    private static client: FirecrawlApp;

    private static getClient() {
        if (!this.client) {
            const apiKey = process.env.FIRECRAWL_API_KEY;
            if (!apiKey) throw new Error("Missing FIRECRAWL_API_KEY");
            this.client = new FirecrawlApp({ apiKey });
        }
        return this.client;
    }

    static async search(query: string, options: { limit?: number; country?: string; lang?: string; formats?: string[]; apiKey?: string } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = options.apiKey ? new FirecrawlApp({ apiKey: options.apiKey }) : this.getClient();
            try {
                // @ts-ignore - SDK types might lag behind API
                const result = await client.search(query, {
                    limit: options.limit || 5,
                    country: options.country,
                    lang: options.lang,
                    scrapeOptions: {
                        formats: (options.formats || ['markdown']) as any
                    },
                } as any);

                if (result && (result as any).data) {
                    return (result as any).data;
                }
                return [];
            } catch (error) {
                // If 402 or 401, don't retry, throw immediately
                if ((error as any).statusCode === 402 || (error as any).statusCode === 401) {
                    throw error;
                }
                throw error; // Let retry handle others
            }
        }, {
            maxRetries: 3,
            baseDelayMs: 2000,
            shouldRetry: (error: any) => {
                const status = error.status || error.statusCode;
                // Don't retry client errors (4xx) except 429
                if (status === 429) return true;
                if (status >= 400 && status < 500) return false;
                return true;
            }
        });
    }

    static async scrape(url: string, formats: string[] = ['markdown']) {
        const client = this.getClient();
        // @ts-ignore
        const result = await client.scrapeUrl(url, {
            formats: formats as any
        });

        if (result && (result as any).success) {
            return (result as any).data || (result as any);
        }
        throw new Error(`Firecrawl Scrape Failed: ${(result as any)?.error || 'Unknown'}`);
    }

    static async extract(urls: string[], schema: any) {
        const client = this.getClient();
        // V2 extract
        // @ts-ignore
        const result = await client.extract(urls, {
            schema: schema // check SDK, usually 'schema' or 'jsonSchema'
        });

        if (result && (result as any).data) {
            return (result as any).data;
        }
        throw new Error(`Firecrawl Extract Failed: ${result?.error || 'Unknown'}`);
    }

    static async crawl(url: string, options: { limit?: number; maxDepth?: number; includePaths?: string[]; excludePaths?: string[] } = {}) {
        const client = this.getClient();
        // @ts-ignore
        const result = await client.crawl(url, {
            limit: options.limit || 100, // Default conservative
            scrapeOptions: {
                formats: ['markdown']
            },
            includePaths: options.includePaths,
            excludePaths: options.excludePaths,
            maxDepth: options.maxDepth || 2
        } as any);

        if (result && (result as any).id) {
            return (result as any).id;
        } else if (result && (result as any).success) {
            // For sync crawls if supported or mock
            return (result as any).id || 'sync-completed';
        }

        throw new Error(`Firecrawl Crawl Failed: ${(result as any)?.error || 'Unknown'}`);
    }
    /**
     * Uses Firecrawl's /agent endpoint for autonomous extraction + navigation
     * 100% Feature Utilization
     */
    static async agent(prompt: string, options: { apiKey?: string; timeout?: number; schema?: any } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = options.apiKey ? new FirecrawlApp({ apiKey: options.apiKey }) : this.getClient();
            try {
                // @ts-ignore
                const agentFn = (client as any).agent;
                if (!agentFn) {
                    throw new Error("Firecrawl SDK does not support .agent() yet. Update dependency.");
                }

                // Correct Signature: agent({ prompt, ...options })
                const result = await agentFn.call(client, {
                    prompt: prompt,
                    timeout: options.timeout || 60000,
                    responseFormat: options.schema ? {
                        type: "json_object",
                        schema: options.schema
                    } : undefined
                });

                if (result && result.data) {
                    return result.data; // Markdown, etc.
                }
                throw new Error("Firecrawl Agent returned no data");
            } catch (error) {
                if ((error as any).statusCode === 402 || (error as any).statusCode === 401) {
                    throw error;
                }
                throw error;
            }
        }, { maxRetries: 1, baseDelayMs: 5000 }); // Agent is expensive, retry carefully
    }
    /**
     * Maps a website to find all URLs (High Recall)
     */
    static async map(url: string, options: { search?: string; limit?: number; country?: string; lang?: string } = {}) {
        const client = this.getClient();
        try {
            // @ts-ignore - SDK types lag
            const result = await client.map(url, {
                search: options.search,
                limit: options.limit || 50,
                country: options.country,
                lang: options.lang
            });

            if (result && (result as any).success) {
                return (result as any).links || [];
            }
            return [];
        } catch (error) {
            console.warn(`Firecrawl Map failed for ${url}`, error);
            return [];
        }
    }

    /**
     * Batch Scrape multiple URLs (High Throughput)
     */
    static async batchScrape(urls: string[], options: { formats?: string[], country?: string; lang?: string } = {}) {
        const client = this.getClient();
        try {
            // @ts-ignore
            const result = await client.batchScrape(urls, {
                formats: options.formats || ['markdown'],
                country: options.country,
                lang: options.lang
            });

            if (result && (result as any).success) {
                return (result as any).data || [];
            }
            return [];
        } catch (error) {
            console.error("Firecrawl Batch Scrape failed", error);
            throw error;
        }
    }
}
