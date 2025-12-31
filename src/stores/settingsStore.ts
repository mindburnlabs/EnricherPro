
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelConfig {
    id: string;
    name: string;
    description?: string;
}

export interface SettingsState {
    // LLM Selection
    model: ModelConfig;

    // API Keys
    apiKeys: {
        openRouter: string;
        firecrawl: string;
        perplexity: string;
    };

    // System Prompts
    prompts: {
        discovery: string;
        synthesis: string;
    };

    // Source Configuration
    sources: {
        official: boolean;
        marketplace: boolean;
        community: boolean;
        blockedDomains: string[];
    };

    // Budgets/Modes
    budgets: {
        fast: { maxQueries: number; limitPerQuery: number };
        balanced: { maxQueries: number; limitPerQuery: number };
        deep: { maxQueries: number; limitPerQuery: number };
    };

    // Preferences
    language: 'en' | 'ru';

    // Actions
    setModel: (model: ModelConfig) => void;
    setApiKey: (key: 'openRouter' | 'firecrawl' | 'perplexity', value: string) => void;
    setPrompt: (agent: 'discovery' | 'synthesis', value: string) => void;
    setBudget: (mode: 'fast' | 'balanced' | 'deep', field: 'maxQueries' | 'limitPerQuery', value: number) => void;
    toggleSource: (type: 'official' | 'marketplace' | 'community') => void;
    addBlockedDomain: (domain: string) => void;
    setBlockedDomains: (domains: string[]) => void;
    removeBlockedDomain: (domain: string) => void;
    setLanguage: (lang: 'en' | 'ru') => void;
    resetPrompts: () => void;
}

const DEFAULT_DISCOVERY_PROMPT = `You are the Lead Research Planner for a Printer Consumables Database.
Your goal is to analyze the user input and construct a precise search strategy.

Research Modes:
- Fast: Focus on quick identification and basic specs. 1-2 generic queries.
- Balanced: Verify against NIX.ru, official sources, and major retailers. 3-4 queries.
- Deep: Exhaustive search. Include Chinese marketplaces (Alibaba/Taobao) for OEM parts, and Legacy Forums (FixYourOwnPrinter) for obscure specs. 5-7 queries.

Rules:
1. ALWAYS include a specific query for "NIX.ru [model] weight" if mode is Balanced or Deep.
2. If the input is a list, set type to "list" and suggest splitting.
3. Use Russian queries for logistics (e.g. "вес упаковки").
4. In DEEP mode, strictly include: "site:alibaba.com [model] specs" and "site:printerknowledge.com [model]".`;

const DEFAULT_SYNTHESIS_PROMPT = `You are the Synthesis Agent for the D² Consumable Database.
Your mission is to extract PRISTINE, VERIFIED data from the provided raw text evidence.

CRITICAL RULES (Evidence-First):
1. ONLY output data explicitly present in the text. Do not guess.
2. If a field is missing, leave it null.
3. For 'compatible_printers_ru', look for lists of printer models.
4. For 'logistics', look for "Package Weight" (вес упаковки) and "Dimensions" (габариты).
5. 'mpn_identity.mpn' is the Manufacturer Part Number. It must be exact.
6. PRIORITIZE data from NIX.ru for logistics vs others.
7. PRIORITIZE Official sources (hp.com, etc) for specs.`;

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            model: { id: 'google/gemini-2.0-pro-exp-02-05:free', name: 'Gemini 2.0 Pro Exp (Free)' },
            apiKeys: {
                openRouter: '',
                firecrawl: '',
                perplexity: ''
            },
            prompts: {
                discovery: DEFAULT_DISCOVERY_PROMPT,
                synthesis: DEFAULT_SYNTHESIS_PROMPT
            },
            sources: {
                official: true,
                marketplace: true,
                community: true,
                blockedDomains: ['pinterest.com', 'youtube.com']
            },
            budgets: {
                fast: { maxQueries: 3, limitPerQuery: 3 },
                balanced: { maxQueries: 6, limitPerQuery: 5 },
                deep: { maxQueries: 15, limitPerQuery: 8 }
            },
            language: 'en',

            setModel: (model) => set({ model }),
            setApiKey: (key, value) => set((state) => ({ apiKeys: { ...state.apiKeys, [key]: value } })),
            setPrompt: (agent, value) => set((state) => ({ prompts: { ...state.prompts, [agent]: value } })),
            setBudget: (mode, field, value) => set((state) => ({
                budgets: {
                    ...state.budgets,
                    [mode]: {
                        ...state.budgets[mode],
                        [field]: value
                    }
                }
            })),
            toggleSource: (type) => set((state) => ({
                sources: { ...state.sources, [type]: !state.sources[type] }
            })),
            addBlockedDomain: (domain) => set((state) => ({
                sources: { ...state.sources, blockedDomains: [...state.sources.blockedDomains, domain] }
            })),
            setBlockedDomains: (domains) => set((state) => ({
                sources: { ...state.sources, blockedDomains: domains }
            })),
            removeBlockedDomain: (domain) => set((state) => ({
                sources: { ...state.sources, blockedDomains: state.sources.blockedDomains.filter(d => d !== domain) }
            })),
            setLanguage: (lang) => set({ language: lang }),
            resetPrompts: () => set((state) => ({
                prompts: {
                    discovery: DEFAULT_DISCOVERY_PROMPT,
                    synthesis: DEFAULT_SYNTHESIS_PROMPT
                }
            }))
        }),
        {
            name: 'd-squared-settings',
        }
    )
);
