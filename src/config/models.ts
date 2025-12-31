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
            'google/gemini-2.0-flash-exp:free', // Replaced failing Xiaomi
            'google/gemini-2.0-flash-lite-preview-02-05:free',
            'openrouter/auto:free'
        ],
        description: "High speed, low cost. Ideal for keyword generation, simple classification, and content scraping."
    },
    [ModelProfile.EXTRACTION]: {
        candidates: [
            'google/gemini-2.0-pro-exp-02-05:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'deepseek/deepseek-r1:free'
        ],
        description: "Reliable JSON extraction capabilities from noisy text."
    },
    [ModelProfile.REASONING]: {
        candidates: [
            'deepseek/deepseek-r1:free', // Major reasoning model
            'google/gemini-2.0-flash-thinking-exp:free',
            'google/gemini-2.0-pro-exp-02-05:free'
        ],
        description: "Complex reasoning, conflict resolution, and truth arbitration."
    },
    [ModelProfile.PLANNING]: {
        candidates: [
            'deepseek/deepseek-r1:free',
            'google/gemini-2.0-flash-thinking-exp:free'
        ],
        description: "Specialized deep search planning and URL discovery."
    },
    [ModelProfile.BEST]: {
        candidates: [
            'google/gemini-2.0-pro-exp-02-05:free',
            'meta-llama/llama-3.3-70b-instruct:free'
        ],
        description: "Highest general capability fallback."
    }
};

export const DEFAULT_MODEL = 'google/gemini-2.0-pro-exp-02-05:free';
