
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
        const { withRetry } = await import("../../lib/reliability");

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
}
