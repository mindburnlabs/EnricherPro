
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

    static async search(query: string, options: { limit?: number; country?: string; lang?: string; formats?: string[]; apiKey?: string; timeout?: number; tbs?: string; filter?: string; scrapeOptions?: any } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = options.apiKey ? new FirecrawlApp({ apiKey: options.apiKey }) : this.getClient();
            try {
                // Map top-level options to SDK structure
                const result = await client.search(query, {
                    limit: options.limit || 5,
                    scrapeOptions: {
                        formats: (options.formats || ['markdown']) as any,
                        ...((options.country || options.lang) && {
                            location: {
                                country: options.country,
                                languages: options.lang ? [options.lang] : undefined
                            }
                        }),
                        ...options.scrapeOptions
                    },
                    timeout: options.timeout,
                    tbs: options.tbs as any,
                });

                if (result && result.web) {
                    return result.web;
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

    static async scrape(url: string, options: {
        formats?: string[],
        schema?: any,
        waitFor?: number,
        actions?: any[],
        location?: { country?: string; languages?: string[] },
        mobile?: boolean,
        maxAge?: number,
        timeout?: number,
        onlyMainContent?: boolean
    } = {}) {
        const client = this.getClient();

        // Construct formats array
        const formats: any[] = options.formats || ['markdown'];

        // If schema is provided, we MUST use type: 'json' with schema
        if (options.schema) {
            // Remove 'json' string if present to avoiding duplication, then add object
            const cleanFormats = formats.filter(f => f !== 'json');
            cleanFormats.push({
                type: 'json',
                schema: options.schema
            });
            // Reassign
            formats.length = 0;
            formats.push(...cleanFormats);
        }

        const result = await client.scrape(url, {
            formats: formats,
            waitFor: options.waitFor || 0,
            actions: options.actions,
            location: options.location,
            mobile: options.mobile,
            maxAge: options.maxAge,
            timeout: options.timeout,
            onlyMainContent: options.onlyMainContent
        });

        if (result && (result as any).success) {
            return (result as any).data || (result as any);
        }
        // If not success but valid response is returned directly (sometimes SDK does this)
        if (result && (result as any).markdown) return result;

        throw new Error(`Firecrawl Scrape Failed: ${(result as any)?.error || 'Unknown'}`);
    }

    static async extract(urls: string[], schema: any) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = this.getClient();
            try {
                // V2 extract: extract(args: { urls, schema })
                const result = await client.extract({
                    urls: urls,
                    schema: schema
                });

                if (result && result.data) {
                    return result.data;
                }
                throw new Error(`Firecrawl Extract Failed: ${(result as any)?.error || 'Unknown'}`);
            } catch (error) {
                // No retry on billing/auth issues
                if ((error as any).statusCode === 402 || (error as any).statusCode === 401) {
                    throw error;
                }
                throw error;
            }
        }, { maxRetries: 3, baseDelayMs: 2000 });
    }

    /**
     * Semantic wrapper for extract to "Enrich" a specific URL with a schema
     */
    static async enrich(url: string, schema: any) {
        return this.extract([url], schema);
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
                // Use public SDK method
                const result = await client.agent({
                    prompt: prompt,
                    timeout: options.timeout || 60000,
                    schema: options.schema
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
     * Recursive Crawl (Deep Indexing)
     * returns crawl ID
     */
    static async crawl(url: string, options: {
        limit?: number;
        maxDepth?: number;
        includePaths?: string[];
        excludePaths?: string[];
        scrapeOptions?: any;
        allowBackwardLinks?: boolean;
        ignoreSitemap?: boolean;
        webhook?: string | { url: string; events?: string[]; metadata?: any };
    } = {}) {
        const client = this.getClient();

        // Handle webhook structure
        let webhook = options.webhook;
        if (typeof webhook === 'string') {
            webhook = { url: webhook, events: ['completed', 'failed'] }; // Default events
        }

        const result = await client.crawl(url, {
            limit: options.limit || 100, // Default conservative
            scrapeOptions: options.scrapeOptions || {
                formats: ['markdown']
            },
            includePaths: options.includePaths,
            excludePaths: options.excludePaths,
            maxDiscoveryDepth: options.maxDepth || 2, // Mapped to SDK expectation
            sitemap: options.ignoreSitemap ? 'skip' : 'include',
            webhook: webhook as any
        });

        if (result && result.id) {
            return result.id;
        } else if (result && (result as any).success) {
            return (result as any).id || 'sync-completed';
        }

        throw new Error(`Firecrawl Crawl Failed: ${(result as any)?.error || 'Unknown'}`);
    }

    /**
     * Maps a website to find all URLs (High Recall)
     */
    static async map(url: string, options: { search?: string; limit?: number; country?: string; lang?: string; sitemap?: boolean } = {}) {
        const client = this.getClient();
        try {
            const result = await client.map(url, {
                search: options.search,
                limit: options.limit || 50,
                // country: options.country, // Check if supported in MapOptions
                // lang: options.lang,       // Check if supported in MapOptions
                sitemap: options.sitemap ? 'include' : 'skip'
            });

            if (result && (result as any).success) {
                return (result as any).links || [];
            }
            return (result as any).links || [];
        } catch (error) {
            console.warn(`Firecrawl Map failed for ${url}`, error);
            return [];
        }
    }


    static async checkCrawlStatus(id: string) {
        const client = this.getClient();
        try {
            const result = await client.getCrawlStatus(id);
            return result;
        } catch (error) {
            console.error(`Check Crawl Status failed for ${id}`, error);
            return null;
        }
    }

    /**
     * Batch Scrape for high-volume synchronous URL verification
     */
    static async batchScrape(urls: string[], options: {
        formats?: string[];
        schema?: any;
        waitFor?: number;
        location?: { country?: string; languages?: string[] };
        ignoreInvalidURLs?: boolean;
        timeout?: number;
    } = {}) {
        const client = this.getClient();

        // Construct formats array logic (same as scrape)
        const formats: any[] = options.formats || ['markdown'];
        if (options.schema) {
            const cleanFormats = formats.filter(f => f !== 'json');
            cleanFormats.push({ type: 'json', schema: options.schema });
            formats.length = 0;
            formats.push(...cleanFormats);
        }

        const result = await client.batchScrape(urls, {
            options: {
                formats: formats,
                waitFor: options.waitFor || 0,
                location: options.location,
            },
            ignoreInvalidURLs: options.ignoreInvalidURLs,
            timeout: options.timeout
        });

        if (result && (result as any).success) {
            return (result as any).data || [];
        }
        throw new Error(`Firecrawl Batch Scrape Failed: ${(result as any)?.error || 'Unknown'}`);
    }
}
