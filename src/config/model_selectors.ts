export const ModelProfile = {
    FAST_CHEAP: 'fast_cheap',
    REASONING: 'reasoning',
    BEST: 'best',
    EXTRACTION: 'extraction',
    PLANNING: 'planning'
} as const;

export type ModelProfile = typeof ModelProfile[keyof typeof ModelProfile];

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
    | { kind: 'auto'; id: 'openrouter/auto' };

export const MODEL_SELECTOR_CONFIGS: Record<ModelProfile, { selectors: ModelSelector[]; description: string }> = {
    [ModelProfile.FAST_CHEAP]: {
        selectors: [
            { kind: 'pattern', regex: '^google/gemini-.*flash-lite', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^anthropic/claude-.*haiku', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^openai/gpt-4o-mini$', strategy: 'latest', limit: 1 },
            // optional free fallback; keep if you want a “no credits” safety valve
            { kind: 'pattern', regex: '^qwen/.*:free$', strategy: 'cheapest_total', limit: 1 },
            { kind: 'auto', id: 'openrouter/auto' }
        ],
        description: 'High speed, low cost parsing/normalization.'
    },

    [ModelProfile.EXTRACTION]: {
        selectors: [
            { kind: 'pattern', regex: '^openai/gpt-4\\.1-mini', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^openai/gpt-4o-mini$', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^anthropic/claude-.*haiku', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^google/gemini-.*flash$', strategy: 'latest', limit: 1 },
            { kind: 'auto', id: 'openrouter/auto' }
        ],
        description: 'Structured JSON extraction from noisy supplier titles.'
    },

    [ModelProfile.PLANNING]: {
        selectors: [
            { kind: 'pattern', regex: '^anthropic/claude-.*sonnet', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^google/gemini-.*flash$', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^openai/gpt-4\\.1-mini', strategy: 'latest', limit: 1 },
            { kind: 'auto', id: 'openrouter/auto' }
        ],
        description: 'Search planning / decomposition / next-action decisions.'
    },

    [ModelProfile.REASONING]: {
        selectors: [
            { kind: 'pattern', regex: '^openai/o1$', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^anthropic/claude-.*sonnet', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^deepseek/deepseek-r1$', strategy: 'latest', limit: 1 },
            { kind: 'auto', id: 'openrouter/auto' }
        ],
        description: 'Conflict resolution, truth arbitration, deep reasoning.'
    },

    [ModelProfile.BEST]: {
        selectors: [
            { kind: 'pattern', regex: '^anthropic/claude-.*sonnet', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^openai/gpt-4o$', strategy: 'latest', limit: 1 },
            { kind: 'pattern', regex: '^google/gemini-.*flash$', strategy: 'latest', limit: 1 },
            { kind: 'auto', id: 'openrouter/auto' }
        ],
        description: 'Highest general capability fallback.'
    }
};
