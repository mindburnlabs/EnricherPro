export type AppMode = 'fast' | 'standard' | 'exhaustive';

export interface SearchConfig {
    maxRuntimeMs: number;
    maxTotalSearchCalls: number;
    maxTotalSourcesCollected: number;
    maxTotalScrapedDocs: number;
    searchLimitPerStep: number;
    minSourcesForValidation: number;
}

export const APP_CONFIG = {
    modes: {
        fast: {
            maxRuntimeMs: 2 * 60 * 1000, // 2 minutes
            maxTotalSearchCalls: 5,
            maxTotalSourcesCollected: 10,
            maxTotalScrapedDocs: 5,
            searchLimitPerStep: 3,
            minSourcesForValidation: 1
        } as SearchConfig,
        standard: {
            maxRuntimeMs: 5 * 60 * 1000, // 5 minutes
            maxTotalSearchCalls: 15,
            maxTotalSourcesCollected: 30,
            maxTotalScrapedDocs: 15,
            searchLimitPerStep: 5,
            minSourcesForValidation: 2
        } as SearchConfig,
        exhaustive: {
            maxRuntimeMs: 12 * 60 * 1000, // 12 minutes
            maxTotalSearchCalls: 40,
            maxTotalSourcesCollected: 100,
            maxTotalScrapedDocs: 50,
            searchLimitPerStep: 10,
            minSourcesForValidation: 2
        } as SearchConfig
    },

    // Whitelists
    sources: {
        logistics: ['nix.ru', 'max.nix.ru'], // Strict NIX only for dimensions/weight
        compatibility: [
            'cartridge.ru',
            'rashodnika.net',
            'hp.com',
            'canon.com', 'canon.ru',
            'epson.com', 'epson.ru',
            'kyocera.com', 'kyoceradocumentsolutions.ru',
            'brother.com', 'brother.ru',
            'xerox.com', 'xerox.ru'
        ]
    },

    timeouts: {
        scrape: 30000, // 30s
        search: 30000
    }
};

export const getModeConfig = (mode: AppMode = 'standard'): SearchConfig => {
    // Browser-side override
    if (typeof window !== 'undefined') {
        const storedMode = localStorage.getItem('firesearch_mode') as AppMode;
        if (storedMode && APP_CONFIG.modes[storedMode]) {
            return APP_CONFIG.modes[storedMode];
        }
    }
    return APP_CONFIG.modes[mode] || APP_CONFIG.modes.standard;
};

export const getFiresearchOptions = () => {
    if (typeof window !== 'undefined') {
        return {
            strictSources: localStorage.getItem('firesearch_strict') === 'true',
            visualValidation: localStorage.getItem('firesearch_images') !== 'false'
        };
    }
    return { strictSources: false, visualValidation: true };
};
