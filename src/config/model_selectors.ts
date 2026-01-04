export const ModelProfile = {
  FAST_CHEAP: 'fast_cheap',
  REASONING: 'reasoning',
  BEST: 'best',
  EXTRACTION: 'extraction',
  PLANNING: 'planning',
} as const;

export type ModelProfile = (typeof ModelProfile)[keyof typeof ModelProfile];

export type ModelSelector =
  | { kind: 'exact'; id: string }
  | {
      kind: 'pattern';
      // match against OpenRouter model.id, e.g. "google/gemini-2.0-flash-lite-001"
      regex: string;
      // if multiple match, pick best by a scoring function (below)
      strategy: 'latest' | 'cheapest_input' | 'cheapest_total' | 'largest_context';
      limit?: number; // keep top N matches
    }
  | {
      kind: 'smart_free';
      sort: 'context' | 'recency'; // 'recency' = newest first, 'context' = largest context window
      limit?: number;
    }
  | { kind: 'auto'; id: 'openrouter/auto' };

export const MODEL_SELECTOR_CONFIGS: Record<
  ModelProfile,
  { selectors: ModelSelector[]; description: string }
> = {
  [ModelProfile.FAST_CHEAP]: {
    selectors: [
      { kind: 'pattern', regex: '^google/gemini-2.0-flash-exp:free', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^google/gemini-.*flash-lite', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^anthropic/claude-.*haiku', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^openai/gpt-4o-mini$', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^meta-llama/llama-3.3-.*free', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^microsoft/phi-4:free', strategy: 'latest', limit: 1 },
      // Smart Free Fallback: Best Free model by Recency
      { kind: 'smart_free', sort: 'recency', limit: 2 },
      { kind: 'auto', id: 'openrouter/auto' },
    ],
    description: 'High speed, low cost parsing/normalization.',
  },

  [ModelProfile.EXTRACTION]: {
    selectors: [
      { kind: 'pattern', regex: '^openai/gpt-4\\.1-mini', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^openai/gpt-4o-mini$', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^anthropic/claude-.*haiku', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^google/gemini-.*flash$', strategy: 'latest', limit: 1 },
      // Smart Free Fallback: Recent free model for extraction
      { kind: 'smart_free', sort: 'recency', limit: 1 },
      { kind: 'auto', id: 'openrouter/auto' },
    ],
    description: 'Structured JSON extraction from noisy supplier titles.',
  },

  [ModelProfile.PLANNING]: {
    selectors: [
      { kind: 'pattern', regex: '^anthropic/claude-.*sonnet', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^google/gemini-.*flash$', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^openai/gpt-4\\.1-mini', strategy: 'latest', limit: 1 },
      // Smart Free Fallback: Largest Context for Planning
      { kind: 'smart_free', sort: 'context', limit: 1 },
      { kind: 'auto', id: 'openrouter/auto' },
    ],
    description: 'Search planning / decomposition / next-action decisions.',
  },

  [ModelProfile.REASONING]: {
    selectors: [
      { kind: 'pattern', regex: '^deepseek/deepseek-r1:free', strategy: 'latest', limit: 1 }, // Specific free
      { kind: 'pattern', regex: '^deepseek/deepseek-r1$', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^openai/o1$', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^anthropic/claude-.*sonnet', strategy: 'latest', limit: 1 },
      // Smart Free Fallback: Largest Context for Reasoning (often correlates with model size/capability for now)
      // or 'recency' to catch new strong free models
      { kind: 'smart_free', sort: 'recency', limit: 3 }, // Increased limit
      { kind: 'auto', id: 'openrouter/auto' },
    ],
    description: 'Conflict resolution, truth arbitration, deep reasoning.',
  },

  [ModelProfile.BEST]: {
    selectors: [
      { kind: 'pattern', regex: '^anthropic/claude-.*sonnet', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^openai/gpt-4o$', strategy: 'latest', limit: 1 },
      { kind: 'pattern', regex: '^google/gemini-.*flash$', strategy: 'latest', limit: 1 },
      // Smart Free Fallback: Best available
      { kind: 'smart_free', sort: 'recency', limit: 1 },
      { kind: 'auto', id: 'openrouter/auto' },
    ],
    description: 'Highest general capability fallback.',
  },
};
