
import { firecrawlSearch, firecrawlScrape } from '../firecrawlService';
import { AgentTask } from './types';

export interface RetrieverResult {
    sourceUrl: string;
    content: string; // Markdown
    title: string;
    timestamp: number;
}

export class RetrieverAgent {

    public async execute(task: AgentTask): Promise<RetrieverResult[]> {
        const { query, mode, url } = task.params;

        // If explicit URL provided (e.g. from a previous search step or specific scrape request)
        if (url) {
            return this.scrape([url]);
        }

        // Default: Search
        if (!query) throw new Error("RetrieverAgent: No query or url provided");

        // Use 'image' mode if requested, though explicit image search might be handled differently
        // For now, text search
        const results = await firecrawlSearch(query, {
            limit: 3,
            scrapeOptions: { formats: ['markdown'] }
        });

        if (!results.success || !results.data) {
            console.warn(`RetrieverAgent: Search failed for "${query}"`, results.error);
            return [];
        }

        // Map to normalized result
        return results.data.map((item: any) => ({
            sourceUrl: item.url,
            content: item.markdown || item.description || '',
            title: item.title || '',
            timestamp: Date.now()
        }));
    }

    private async scrape(urls: string[]): Promise<RetrieverResult[]> {
        // Parallel scrape
        const promises = urls.map(async (url) => {
            const res = await firecrawlScrape(url, { formats: ['markdown'] });
            if (res.success && res.data) {
                return {
                    sourceUrl: url,
                    content: res.data.markdown || '',
                    title: res.data.metadata?.title || '',
                    timestamp: Date.now()
                };
            }
            return null;
        });

        const results = await Promise.all(promises);
        return results.filter(r => r !== null) as RetrieverResult[];
    }
}

export const retrieverAgent = new RetrieverAgent();
