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
            'openrouter/auto'
        ],
        description: "High speed, low cost. Ideal for keyword generation, simple classification, and content scraping."
    },
    [ModelProfile.EXTRACTION]: {
        candidates: [
            'openrouter/auto'
        ],
        description: "Reliable JSON extraction capabilities from noisy text."
    },
    [ModelProfile.REASONING]: {
        candidates: [
            'openrouter/auto'
        ],
        description: "Complex reasoning, conflict resolution, and truth arbitration."
    },
    [ModelProfile.PLANNING]: {
        candidates: [
            'openrouter/auto'
        ],
        description: "Specialized deep search planning and URL discovery."
    },
    [ModelProfile.BEST]: {
        candidates: [
            'openrouter/auto'
        ],
        description: "Highest general capability fallback."
    }
};

export const DEFAULT_MODEL = 'openrouter/auto';
