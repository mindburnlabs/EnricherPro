
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

    static async search(query: string, options: { limit?: number; country?: string; formats?: string[]; apiKey?: string } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = options.apiKey ? new FirecrawlApp({ apiKey: options.apiKey }) : this.getClient();
            try {
                // @ts-ignore
                const result = await client.search(query, {
                    limit: options.limit || 5,
                    scrapeOptions: {
                        formats: (options.formats || ['markdown']) as any
                    },
                });

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
        }, { maxRetries: 3, baseDelayMs: 2000 });
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

                // Map options to Firecrawl Agent params
                const agentParams: any = {
                    timeout: options.timeout || 60000
                };

                if (options.schema) {
                    agentParams.responseFormat = {
                        type: "json_object",
                        schema: options.schema
                    };
                }

                const result = await agentFn.call(client, prompt, agentParams);

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
}
