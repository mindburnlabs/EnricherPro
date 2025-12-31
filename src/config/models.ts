export enum ModelProfile {
    FAST_CHEAP = 'fast_cheap',
    REASONING = 'reasoning',
    BEST = 'best',
    EXTRACTION = 'extraction',
    PLANNING = 'planning'
}

export const MODEL_CONFIGS = {
    [ModelProfile.FAST_CHEAP]: {
        candidates: [
            'openrouter/xiaomi/mimo-v2-flash:free',
            'google/gemini-2.0-flash-lite',
            'google/gemini-2.0-flash-001'
        ],
        description: "High speed, low cost. Ideal for keyword generation, simple classification, and content scraping."
    },
    [ModelProfile.EXTRACTION]: {
        candidates: [
            'google/gemini-2.0-flash-001',
            'openrouter/minimax/minimax-01',
            'openai/gpt-4o-mini'
        ],
        description: "Reliable JSON extraction capabilities from noisy text."
    },
    [ModelProfile.REASONING]: {
        candidates: [
            'deepseek/deepseek-r1',
            'google/gemini-2.0-flash-thinking-exp-01-21',
            'openai/o3-mini'
        ],
        description: "Complex reasoning, conflict resolution, and truth arbitration."
    },
    [ModelProfile.PLANNING]: {
        candidates: [
            'perplexity/sonar-reasoning-pro',
            'openrouter/perplexity/sonar-reasoning-pro',
            'deepseek/deepseek-r1'
        ],
        description: "Specialized deep search planning and URL discovery."
    },
    [ModelProfile.BEST]: {
        candidates: [
            'anthropic/claude-3-5-sonnet',
            'openai/gpt-4o'
        ],
        description: "Highest general capability fallback."
    }
};

export const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
