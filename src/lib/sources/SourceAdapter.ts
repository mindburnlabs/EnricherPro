export interface SourceResult {
  url: string;
  contentSnippet: string;
  contentHash?: string; // Optional if not computed yet
  priorityScore: number; // 0-100
  metadata?: Record<string, any>; // Debug info, HTTP status
}

export interface SourceAdapter {
  name: string;
  sourceType: 'official_website' | 'marketplace' | 'datasheet_pdf' | 'forum' | 'manual' | 'generic';
  priority: number; // Base priority

  fetch(query: string): Promise<SourceResult[]>;
  validate(url: string): Promise<boolean>;
}

// --- Source Manager (Circuit Breaker holder) ---

export class SourceManager {
  private adapters: SourceAdapter[] = [];

  register(adapter: SourceAdapter) {
    this.adapters.push(adapter);
  }

  getAdapters(): SourceAdapter[] {
    return this.adapters.sort((a, b) => b.priority - a.priority);
  }

  async fetchAll(query: string): Promise<SourceResult[]> {
    const results: SourceResult[] = [];
    // Sequential or parallel based on policy? Parallel is faster.
    const promises = this.adapters.map(async (adapter) => {
      try {
        // TODO: Add Circuit Breaker check here
        const adapterResults = await adapter.fetch(query);
        return adapterResults;
      } catch (error) {
        console.error(`Source ${adapter.name} failed:`, error);
        return [];
      }
    });

    const fetchResults = await Promise.all(promises);
    fetchResults.forEach((r) => results.push(...r));

    return results.sort((a, b) => b.priorityScore - a.priorityScore);
  }
}
