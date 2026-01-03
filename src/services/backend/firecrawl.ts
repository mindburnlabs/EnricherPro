
import FirecrawlApp from '@mendable/firecrawl-js';

// Server-side only client
export class BackendFirecrawlService {
    // REMOVED: Singleton client with process.env fallback.
    // Each request MUST provide an API key.

    private static getClient(apiKey?: string) {
        if (!apiKey) throw new Error("Missing Firecrawl API Key. Please configure it in the UI Settings.");
        return new FirecrawlApp({ apiKey });
    }

    static async search(query: string, options: { limit?: number; country?: string; lang?: string; formats?: string[]; apiKey?: string; timeout?: number; tbs?: string; filter?: string; scrapeOptions?: any; onRetry?: (attempt: number, error: any, delay: number) => void } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = this.getClient(options.apiKey);
            try {
                // Map top-level options to SDK structure
                const result = await client.search(query, {
                    limit: options.limit || 5,
                    scrapeOptions: (options.formats && options.formats.length > 0) ? {
                        formats: options.formats as any,
                        ...((options.country || options.lang) && {
                            location: {
                                country: options.country,
                                languages: options.lang ? [options.lang] : undefined
                            }
                        }),
                        ...options.scrapeOptions
                    } : undefined,
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
            },
            onRetry: options.onRetry
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
        onlyMainContent?: boolean,
        apiKey?: string;
        onRetry?: (attempt: number, error: any, delay: number) => void;
    } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        // Custom Retry Logic for Scrape
        const shouldRetryScrape = (error: any) => {
            const msg = error.message || "";
            // Deterministic errors - DO NOT RETRY
            if (msg.includes("File size exceeds") || msg.includes("Invalid URL") || msg.includes("Unsupported file")) {
                return false;
            }
            // Standard checks
            const status = error.status || error.statusCode;
            if (status === 429) return true;
            if (status >= 400 && status < 500) return false;
            return true;
        };

        return withRetry(async () => {
            const client = this.getClient(options.apiKey);

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
        }, {
            maxRetries: 3,
            baseDelayMs: 2000,
            onRetry: options.onRetry,
            shouldRetry: shouldRetryScrape
        });
    }

    static async extract(urls: string[], schema: any, options: { apiKey?: string } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = this.getClient(options.apiKey);
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
     * Semantic wrapper for extract/scrape to "Enrich" a specific URL with a schema.
     * INTELLIGENT ROUTING: 
     * - If options (actions, location) are provided -> Use `scrape` with schema (supports interaction).
     * - If simple URL -> Use `scrape` with schema (standard v2 approach).
     * - We avoid `extract` endpoint as it lacks interaction capabilities needed for complex sites like nix.ru.
     */
    static async enrich(url: string, schema: any, options: {
        apiKey?: string;
        actions?: any[];
        location?: { country?: string; languages?: string[] };
        mobile?: boolean;
        waitFor?: number;
    } = {}) {
        // Use scrape with strict schema output (V2 'JSON' format)
        return this.scrape(url, {
            formats: ['markdown'], // Get markdown too for verification/fallback
            schema: schema,
            actions: options.actions,
            location: options.location,
            mobile: options.mobile,
            waitFor: options.waitFor,
            apiKey: options.apiKey
        });
    }

    /**
     * Uses Firecrawl's /agent endpoint for autonomous extraction + navigation
     * 100% Feature Utilization
     */
    static async agent(prompt: string, options: { apiKey?: string; timeout?: number; schema?: any } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = this.getClient(options.apiKey);
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
        apiKey?: string;
    } = {}) {
        const client = this.getClient(options.apiKey);

        // Handle webhook structure
        let webhook = options.webhook;
        if (typeof webhook === 'string') {
            webhook = { url: webhook, events: ['completed', 'failed'] }; // Default events
        }

        const result = await client.crawl(url, {
            limit: options.limit || 10, // Default conservative match
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
    static async map(url: string, options: { search?: string; limit?: number; country?: string; lang?: string; sitemap?: boolean; apiKey?: string } = {}) {
        const client = this.getClient(options.apiKey);
        try {
            const result = await client.map(url, {
                search: options.search,
                limit: options.limit || 10,
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


    static async checkCrawlStatus(id: string, apiKey?: string) {
        const client = this.getClient(apiKey);
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
        apiKey?: string;
        maxAge?: number;
        onRetry?: (attempt: number, error: any, delay: number) => void;
    } = {}) {
        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const client = this.getClient(options.apiKey);

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
                    maxAge: options.maxAge,
                },
                ignoreInvalidURLs: options.ignoreInvalidURLs,
                timeout: options.timeout
            });

            if (result && (result as any).success) {
                return (result as any).data || [];
            }
            throw new Error(`Firecrawl Batch Scrape Failed: ${(result as any)?.error || 'Unknown'}`);
        }, {
            maxRetries: 3,
            baseDelayMs: 2000,
            onRetry: options.onRetry
        });
    }
}
