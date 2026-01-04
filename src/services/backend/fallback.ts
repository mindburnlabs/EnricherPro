import { BackendLLMService } from './llm.js';
import { RetrieverResult } from '../agents/DiscoveryAgent.js';
import { FallbackResultSchema } from '../../schemas/agent_schemas.js';

export class FallbackSearchService {
  /**
   * Performs an "online" search using an LLM (e.g., Perplexity/Sonar) when the primary scraper fails.
   */
  static async search(query: string, apiKeys?: Record<string, string>): Promise<RetrieverResult[]> {
    try {
      // Use reliable online model via Auto (with web plugin)
      const model = 'openrouter/auto';

      const response = await BackendLLMService.complete({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a fallback search engine. 
            The user is asking for specific information about a printer consumable or product.
            You MUST perform a real-time search using your online capabilities.
            
            Return a JSON object with a "results" array.
            Each item in "results" must have:
            - "title": string
            - "url": string (The actual source URL you found)
            - "snippet": string (A relevant excerpt)
            
            If you cannot find specific sources, return an empty array.
            `,
          },
          { role: 'user', content: `Search for: "${query}"` },
        ],
        jsonSchema: FallbackResultSchema,
        apiKeys,
        plugins: [{ id: 'web' }], // Enable OpenRouter Web Search
      });

      let cleanJson = response || '{}';
      // Strip code fences if present
      cleanJson = cleanJson
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleanJson);
      if (!parsed.results || !Array.isArray(parsed.results)) {
        return [];
      }

      return parsed.results.map((r: any) => ({
        url: r.url || 'https://perplexity.ai',
        title: r.title || 'Perplexity Search Result',
        markdown: r.snippet || '',
        source_type: 'other', // Fallback is always generic/other unless we analyze URL
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Fallback Search Failed:', error);
      return [];
    }
  }
}
