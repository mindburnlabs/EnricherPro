
import { useState, useEffect } from 'react';

export interface ResearchConfig {
    apiKeys: {
        firecrawl: string;
        google: string;
        openrouter: string;
    };
    prompts: {
        discovery: string;
        synthesis: string;
    };
    budgets: {
        fast: { maxQueries: number; limitPerQuery: number };
        balanced: { maxQueries: number; limitPerQuery: number };
        deep: { maxQueries: number; limitPerQuery: number };
    };
    sources: {
        allowedTypes: {
            official: boolean;
            marketplaces: boolean;
            community: boolean;
            search: boolean;
        };
        blockedDomains: string[];
    };
    lang: string;
}

const defaultBudgets = {
    fast: { maxQueries: 2, limitPerQuery: 3 },
    balanced: { maxQueries: 5, limitPerQuery: 5 },
    deep: { maxQueries: 12, limitPerQuery: 10 }
};

const defaultSources = {
    allowedTypes: {
        official: true,
        marketplaces: true,
        community: true,
        search: true
    },
    blockedDomains: []
};

export const useResearchConfig = () => {
    // Initialize state from localStorage or defaults
    const [config, setConfig] = useState<ResearchConfig>(() => {
        if (typeof window === 'undefined') return { apiKeys: {}, prompts: {}, budgets: defaultBudgets, sources: defaultSources, lang: 'en' } as any;

        const apiKeys = {
            firecrawl: localStorage.getItem('firecrawl_key') || '',
            google: localStorage.getItem('google_key') || '',
            openrouter: localStorage.getItem('openrouter_key') || ''
        };

        const prompts = localStorage.getItem('agent_prompts')
            ? JSON.parse(localStorage.getItem('agent_prompts')!)
            : { discovery: '', synthesis: '' };

        const budgets = localStorage.getItem('agent_budgets')
            ? JSON.parse(localStorage.getItem('agent_budgets')!)
            : defaultBudgets;

        const sources = localStorage.getItem('research_sources')
            ? JSON.parse(localStorage.getItem('research_sources')!)
            : defaultSources;

        const lang = localStorage.getItem('i18nextLng') || 'en';

        return { apiKeys, prompts, budgets, sources, lang };
    });

    // Save to localStorage whenever config changes
    const updateConfig = (newConfig: Partial<ResearchConfig>) => {
        const merged = { ...config, ...newConfig };
        setConfig(merged);

        if (newConfig.apiKeys) {
            localStorage.setItem('firecrawl_key', newConfig.apiKeys.firecrawl);
            localStorage.setItem('google_key', newConfig.apiKeys.google);
            localStorage.setItem('openrouter_key', newConfig.apiKeys.openrouter);
        }

        if (newConfig.prompts) {
            localStorage.setItem('agent_prompts', JSON.stringify(newConfig.prompts));
        }

        if (newConfig.budgets) {
            localStorage.setItem('agent_budgets', JSON.stringify(newConfig.budgets));
        }

        if (newConfig.sources) {
            localStorage.setItem('research_sources', JSON.stringify(newConfig.sources));
        }
    };

    return { config, updateConfig };
};
