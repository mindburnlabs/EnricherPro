import React, { useState, useEffect } from 'react';
import { X, Save, Moon, Sun, Globe, Brain, Zap, Key, Layout, Shield, Database, Check, History, ChevronRight, AlertCircle, RefreshCw, Wand2, Factory, Search, Server, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, SettingsState, DEFAULT_DISCOVERY_PROMPT, DEFAULT_SYNTHESIS_PROMPT, DEFAULT_DISCOVERY_PROMPT_RU, DEFAULT_SYNTHESIS_PROMPT_RU, DEFAULT_LOGISTICS_PROMPT, DEFAULT_LOGISTICS_PROMPT_RU } from '../../stores/settingsStore.js';

interface SettingsViewProps {
    isOpen: boolean;
    onClose: () => void;
    onThemeChange: () => void;
    currentTheme: 'light' | 'dark';
}

type Tab = 'general' | 'models' | 'api' | 'prompts' | 'modes' | 'sources';

const ModelSelector: React.FC<{ label: string; desc: string; value: string; onChange: (v: string) => void; models: any[]; defaultModel: string }> = ({ label, desc, value, onChange, models, defaultModel }) => (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1">{label}</label>
        <p className="text-xs text-gray-500 mb-3">{desc}</p>
        <div className="relative">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                list={`models-${label.replace(/\s+/g, '-')}`}
                placeholder={defaultModel}
                className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <datalist id={`models-${label.replace(/\s+/g, '-')}`}>
                {models.map(m => (
                    <option key={m.id} value={m.id} />
                ))}
            </datalist>
            {!value && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">Default: {defaultModel.split('/')[1] || defaultModel}</span>}
        </div>
    </div>
);

// --- Subcomponents ---

const Section: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500">{title}</h4>
        {children}
    </div>
);

const ThemeCard: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${active
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500'
            : 'bg-white dark:bg-black border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700'
            }`}
    >
        <div className={`p-2 rounded-full ${active ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            {icon}
        </div>
        <span className={`font-medium ${active ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
        {active && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
    </button>
);

const InputGroup: React.FC<{ label: string; desc?: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }> = ({ label, desc, value, onChange, placeholder, type = 'text' }) => (
    <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-200">{label}</label>
        {desc && <p className="text-xs text-gray-500 mb-2">{desc}</p>}
        <div className="relative group">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm group-hover:bg-white dark:group-hover:bg-black"
            />
            {value && <Check className="absolute right-3 top-3 w-4 h-4 text-emerald-500" />}
        </div>
    </div>
);

const ToggleRow: React.FC<{ label: string; desc: string; active: boolean; onToggle: () => void }> = ({ label, desc, active, onToggle }) => (
    <button
        onClick={onToggle}
        className={`flex items-start justify-between p-4 rounded-xl border transition-all text-left ${active
            ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
            : 'bg-white dark:bg-black border-gray-200 dark:border-gray-800 opacity-75 grayscale'
            }`}
    >
        <div>
            <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${active ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{label}</span>
                {active && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">ON</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-[200px] sm:max-w-xs">{desc}</p>
        </div>
        <div className={`w-11 h-6 rounded-full flex items-center transition-colors p-1 mt-1 ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${active ? 'translate-x-5' : ''}`} />
        </div>
    </button>
);

const PromptEditor: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-gray-500">{label}</span>
            <History className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600" />
        </div>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 w-full p-4 bg-transparent outline-none font-mono text-xs leading-relaxed resize-none text-gray-700 dark:text-gray-300 h-64"
            placeholder="// System prompt instructions..."
        />
    </div>
);

const SourceCard: React.FC<{
    label: string;
    desc: string;
    active: boolean;
    onToggle: () => void;
    specificDomains: string[];
    onSpecificDomainsChange: (domains: string[]) => void;
    placeholder: string;
}> = ({ label, desc, active, onToggle, specificDomains, onSpecificDomainsChange, placeholder }) => (
    <div className={`rounded-xl border transition-all ${active
        ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-black border-gray-200 dark:border-gray-800 opacity-75 grayscale'
        }`}>
        <button
            onClick={onToggle}
            className="w-full flex items-start justify-between p-4 text-left"
        >
            <div>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${active ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{label}</span>
                    {active && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">ON</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px] sm:max-w-xs">{desc}</p>
            </div>
            <div className={`w-11 h-6 rounded-full flex items-center transition-colors p-1 mt-1 ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${active ? 'translate-x-5' : ''}`} />
            </div>
        </button>

        {active && (
            <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900/30">
                    <label className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 block">
                        Allow Only Specific Domains (Optional)
                    </label>
                    <textarea
                        value={specificDomains.join(', ')}
                        onChange={(e) => onSpecificDomainsChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder={placeholder}
                        className="w-full bg-white dark:bg-black border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none h-16 resize-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Leave empty to allow all {label} sources.</p>
                </div>
            </div>
        )}
    </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose, onThemeChange, currentTheme }) => {
    if (!isOpen) return null;

    const { t, i18n } = useTranslation(['settings', 'common']);
    const store = useSettingsStore();

    // Local state for editing before save
    const [localConfig, setLocalConfig] = useState<SettingsState>(store);
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [hasChanges, setHasChanges] = useState(false);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [modelSearch, setModelSearch] = useState('');

    useEffect(() => {
        // Sync local config with store when opening
        if (isOpen) {
            // @ts-ignore - Zustand types unwrapping
            setLocalConfig({ ...store });
            setHasChanges(false);
        }
    }, [isOpen, store.model.id, store.language]); // Depend on key props to re-sync if needed

    // Detect changes
    useEffect(() => {
        // Deep compare roughly
        const isDifferent = JSON.stringify(localConfig.apiKeys) !== JSON.stringify(store.apiKeys) ||
            JSON.stringify(localConfig.prompts) !== JSON.stringify(store.prompts) ||
            JSON.stringify(localConfig.sources) !== JSON.stringify(store.sources) ||
            JSON.stringify(localConfig.budgets) !== JSON.stringify(store.budgets) ||
            localConfig.model.id !== store.model.id ||
            localConfig.planningModel !== store.planningModel ||
            localConfig.extractionModel !== store.extractionModel ||
            localConfig.reasoningModel !== store.reasoningModel ||
            localConfig.language !== store.language ||
            (localConfig.useSota ?? false) !== (store.useSota ?? false) ||
            JSON.stringify(localConfig.sources.specificOfficial) !== JSON.stringify(store.sources.specificOfficial) ||
            JSON.stringify(localConfig.sources.specificMarketplace) !== JSON.stringify(store.sources.specificMarketplace) ||
            JSON.stringify(localConfig.sources.specificOfficial) !== JSON.stringify(store.sources.specificOfficial) ||
            JSON.stringify(localConfig.sources.specificMarketplace) !== JSON.stringify(store.sources.specificMarketplace) ||
            JSON.stringify(localConfig.sources.specificCommunity) !== JSON.stringify(store.sources.specificCommunity) ||
            (localConfig.useFlashPlanner ?? true) !== (store.useFlashPlanner ?? true) ||
            (localConfig.offlineMode ?? false) !== (store.offlineMode ?? false) ||
            (localConfig.preferGraph ?? true) !== (store.preferGraph ?? true);
        setHasChanges(isDifferent);
    }, [localConfig, store]);

    const handleSave = () => {
        // Commit changes to store
        store.setModel(localConfig.model);
        store.setAgentModel('planning', localConfig.planningModel);
        store.setAgentModel('extraction', localConfig.extractionModel);
        store.setAgentModel('reasoning', localConfig.reasoningModel);
        store.setApiKey('firecrawl', localConfig.apiKeys.firecrawl);
        store.setApiKey('openRouter', localConfig.apiKeys.openRouter);

        store.setPrompt('discovery', localConfig.prompts.discovery);
        store.setPrompt('synthesis', localConfig.prompts.synthesis);
        store.setPrompt('logistics', localConfig.prompts.logistics);
        store.setLanguage(localConfig.language);
        store.setLanguage(localConfig.language);
        store.setUseSota(localConfig.useSota);
        store.setUseFlashPlanner(localConfig.useFlashPlanner);

        store.setOfflineMode(localConfig.offlineMode);
        store.setPreferGraph(localConfig.preferGraph);

        store.setBlockedDomains(localConfig.sources.blockedDomains);

        if (localConfig.sources.official !== store.sources.official) store.toggleSource('official');
        if (localConfig.sources.marketplace !== store.sources.marketplace) store.toggleSource('marketplace');
        if (localConfig.sources.community !== store.sources.community) store.toggleSource('community');

        store.setSpecificDomains('official', localConfig.sources.specificOfficial);
        store.setSpecificDomains('marketplace', localConfig.sources.specificMarketplace);
        store.setSpecificDomains('community', localConfig.sources.specificCommunity);

        // Budgets
        (['fast', 'balanced', 'deep'] as const).forEach(mode => {
            store.setBudget(mode, 'maxQueries', localConfig.budgets[mode].maxQueries);
            store.setBudget(mode, 'maxQueries', localConfig.budgets[mode].maxQueries);
            store.setBudget(mode, 'limitPerQuery', localConfig.budgets[mode].limitPerQuery);
            store.setBudget(mode, 'concurrency', localConfig.budgets[mode].concurrency || 5);
        });

        if (localConfig.language !== i18n.language) {
            i18n.changeLanguage(localConfig.language);
        }

        setHasChanges(false);
        onClose();
    };

    const fetchModels = async () => {
        if (!localConfig.apiKeys.openRouter) {
            alert(t('settings:models.fetch_error')); // Simple alert for now
            return;
        }
        setIsFetchingModels(true);
        try {
            const res = await fetch('https://openrouter.ai/api/v1/models');
            const data = await res.json();
            if (data.data) {
                const models = data.data.sort((a: any, b: any) => a.id.localeCompare(b.id));
                setAvailableModels(models);
            }
        } catch (e) {
            alert(t('settings:models.fetch_error'));
        } finally {
            setIsFetchingModels(false);
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'general', label: t('settings:tabs.general'), icon: <Layout className="w-4 h-4" /> },
        { id: 'models', label: t('settings:tabs.models'), icon: <Database className="w-4 h-4" /> },
        { id: 'api', label: t('settings:tabs.api'), icon: <Key className="w-4 h-4" /> },
        { id: 'modes', label: t('settings:tabs.modes'), icon: <Zap className="w-4 h-4" /> },
        { id: 'sources', label: t('settings:tabs.sources'), icon: <Shield className="w-4 h-4" /> },
        { id: 'prompts', label: t('settings:tabs.prompts'), icon: <Brain className="w-4 h-4" /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-[#0f1115] w-full max-w-5xl h-[90vh] md:h-[85vh] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-gray-200 dark:border-gray-800">

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-gray-50/50 dark:bg-black/20 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex flex-row md:flex-col pt-4 md:pt-6 pb-2 md:pb-4 flex-shrink-0">
                    <div className="px-4 md:px-6 mb-2 md:mb-8 hidden md:block">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t('settings:title')}</h2>
                        <p className="text-xs text-gray-500 mt-1">{t('settings:subtitle')}</p>
                    </div>

                    <nav className="flex-1 px-2 md:px-3 flex flex-row md:flex-col gap-1 md:gap-0 overflow-x-auto no-scrollbar items-center md:items-stretch">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 md:gap-3 px-3 md:px-3 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                    }`}
                            >
                                <span className={activeTab === tab.id ? 'text-emerald-500' : 'text-gray-400'}>{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && <ChevronRight className="hidden md:block w-3.5 h-3.5 ml-auto text-gray-400" />}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1115]">
                    <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#0f1115] sticky top-0 z-10">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tabs.find(t => t.id === activeTab)?.label}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings:subtitle')}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
                        {activeTab === 'general' && (
                            <div className="space-y-8 max-w-2xl animate-in slide-in-from-right-4 duration-300">
                                <Section title={t('settings:general.appearance')}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <ThemeCard
                                            active={currentTheme === 'light'}
                                            onClick={() => currentTheme !== 'light' && onThemeChange()}
                                            icon={<Sun className="w-5 h-5" />}
                                            label={t('settings:general.light')}
                                        />
                                        <ThemeCard
                                            active={currentTheme === 'dark'}
                                            onClick={() => currentTheme !== 'dark' && onThemeChange()}
                                            icon={<Moon className="w-5 h-5" />}
                                            label={t('settings:general.dark')}
                                        />
                                    </div>
                                </Section>

                                <Section title={t('settings:general.localization')}>
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                                <Globe className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{t('settings:general.language')}</div>
                                                <div className="text-xs text-gray-500">{t('settings:general.language_desc')}</div>
                                            </div>
                                        </div>
                                        <select
                                            value={localConfig.language}
                                            onChange={(e) => {
                                                const newLang = e.target.value as 'en' | 'ru';
                                                let newDiscovery = localConfig.prompts.discovery;
                                                let newSynthesis = localConfig.prompts.synthesis;
                                                let newLogistics = localConfig.prompts.logistics;

                                                // Robust Check: If the prompt contains key English phrases, we assume it's English.
                                                // If it contains key Russian phrases, we assume it's Russian.
                                                // This is safer than checking the exact start of the string.

                                                const isEnDiscovery = newDiscovery.includes("Lead Research Planner") || newDiscovery.includes("Research Modes");
                                                const isRuDiscovery = newDiscovery.includes("Ведущий Планировщик") || newDiscovery.includes("Режимы Исследования");

                                                const isEnSynthesis = newSynthesis.includes("Synthesis Agent") || newSynthesis.includes("PRISTINE");
                                                const isRuSynthesis = newSynthesis.includes("Агент Синтеза") || newSynthesis.includes("ЧИСТЫЕ");

                                                const isEnLogistics = newLogistics && (newLogistics.includes("NIX.ru Data Extractor") || newLogistics.includes("Gross Weight"));
                                                const isRuLogistics = newLogistics && (newLogistics.includes("Экстрактор Данных NIX.ru") || newLogistics.includes("Вес брутто"));

                                                if (newLang === 'ru') {
                                                    // Switch to RU if currently EN (or default)
                                                    if (isEnDiscovery || !isRuDiscovery) newDiscovery = DEFAULT_DISCOVERY_PROMPT_RU;
                                                    if (isEnSynthesis || !isRuSynthesis) newSynthesis = DEFAULT_SYNTHESIS_PROMPT_RU;
                                                    if (isEnLogistics || !isRuLogistics) newLogistics = DEFAULT_LOGISTICS_PROMPT_RU;
                                                } else {
                                                    // Switch to EN if currently RU (or default)
                                                    if (isRuDiscovery || !isEnDiscovery) newDiscovery = DEFAULT_DISCOVERY_PROMPT;
                                                    if (isRuSynthesis || !isEnSynthesis) newSynthesis = DEFAULT_SYNTHESIS_PROMPT;
                                                    if (isRuLogistics || !isEnLogistics) newLogistics = DEFAULT_LOGISTICS_PROMPT;
                                                }

                                                setLocalConfig({ ...localConfig, language: newLang, prompts: { ...localConfig.prompts, discovery: newDiscovery, synthesis: newSynthesis, logistics: newLogistics! } });
                                            }}
                                            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="en">English (US)</option>
                                            <option value="ru">Русский</option>
                                        </select>
                                    </div>
                                </Section>

                                <Section title="Developer / SOTA Mode">
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
                                        <ToggleRow
                                            label="SOTA Debug Info"
                                            desc="Show routing strategies, token usage, and strict schema validation status in the UI."
                                            active={localConfig.useSota || false}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, useSota: !prev.useSota }))}
                                        />
                                        <div className="h-px bg-gray-200 dark:bg-gray-800" />
                                        <ToggleRow
                                            label="Flash Planner (Speed)"
                                            desc="Use Gem 2.0 Flash for planning (0.5s latency). Disable for higher quality logic (2s latency)."
                                            active={localConfig.useFlashPlanner ?? true}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, useFlashPlanner: !(prev.useFlashPlanner ?? true) }))}
                                        />
                                        <div className="h-px bg-gray-200 dark:bg-gray-800" />
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">Routing Preference</div>
                                                <div className="text-xs text-gray-500 mt-1">Optimize auto-routing for Speed or Cost.</div>
                                            </div>
                                            <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                                                <button
                                                    onClick={() => setLocalConfig(prev => ({ ...prev, routingPreference: 'performance' }))}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.routingPreference === 'performance' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                                                >
                                                    Performance
                                                </button>
                                                <button
                                                    onClick={() => setLocalConfig(prev => ({ ...prev, routingPreference: 'cost' }))}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.routingPreference === 'cost' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                                                >
                                                    Cost
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </Section>
                            </div>
                        )}

                        {activeTab === 'models' && (
                            <div className="space-y-6 max-w-2xl animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Brain className="w-5 h-5 text-emerald-600" />
                                            {t('settings:models.title')}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                            Configure the intelligence engine for each specific agent.
                                        </p>
                                    </div>
                                    <button
                                        onClick={fetchModels}
                                        disabled={isFetchingModels}
                                        className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        title={t('settings:models.fetch_tip')}
                                    >
                                        {isFetchingModels ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> : <RefreshCw className="w-4 h-4 text-gray-500" />}
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <ModelSelector
                                        label="Discovery Agent (Planner)"
                                        desc="High-speed model for search strategy and recursive crawling. Recommended: Google Gemini 2.0 Flash."
                                        value={localConfig.planningModel}
                                        onChange={(val) => setLocalConfig(prev => ({ ...prev, planningModel: val }))}
                                        models={availableModels}
                                        defaultModel="openrouter/auto"
                                    />
                                    <ModelSelector
                                        label="Extraction Agent (Parser)"
                                        desc="Cost-effective model for parsing noisy HTML from NIX.ru/Amazon. Recommended: Gemini Flash or Claude Haiku."
                                        value={localConfig.extractionModel}
                                        onChange={(val) => setLocalConfig(prev => ({ ...prev, extractionModel: val }))}
                                        models={availableModels}
                                        defaultModel="openrouter/auto"
                                    />
                                    <ModelSelector
                                        label="Synthesis Agent (Reasoner)"
                                        desc="High-intelligence model for conflict resolution and final truth merging. Recommended: Claude 3.5 Sonnet or GPT-4o."
                                        value={localConfig.reasoningModel}
                                        onChange={(val) => setLocalConfig(prev => ({ ...prev, reasoningModel: val, model: { id: val, name: val } }))} // Sync main model with reasoning for now
                                        models={availableModels}
                                        defaultModel="openrouter/auto"
                                    />
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl flex gap-3">
                                    <Zap className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Pro Tip (2026 SOTA)</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                            For best results, use <b>openrouter/auto</b> to let the system automatically route to the best available model (Gemini 2.0 Flash, Claude 3.5, etc) based on your budget preference.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'api' && (
                            <div className="space-y-6 max-w-2xl animate-in slide-in-from-right-4 duration-300">
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl p-4 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                        {t('settings:api.security_note')}
                                    </p>
                                </div>
                                <InputGroup
                                    label={t('settings:api.firecrawl')}
                                    value={localConfig.apiKeys.firecrawl}
                                    onChange={(v) => setLocalConfig({ ...localConfig, apiKeys: { ...localConfig.apiKeys, firecrawl: v } })}
                                    placeholder="fc-..."
                                    type="password"
                                />
                                <InputGroup
                                    label={t('settings:api.openrouter')}
                                    value={localConfig.apiKeys.openRouter}
                                    onChange={(v) => setLocalConfig({ ...localConfig, apiKeys: { ...localConfig.apiKeys, openRouter: v } })}
                                    placeholder="sk-or-..."
                                    type="password"
                                />
                            </div>
                        )}

                        {activeTab === 'modes' && (
                            <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">

                                <Section title="Vertical Search Engine (Graph-Lite)">
                                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4">
                                        <div className="flex flex-col gap-4">
                                            <ToggleRow
                                                label="Prefer Graph-Lite"
                                                desc="Trust local Graph DB (aliases, compatibility) over live web search. Faster & more deterministic."
                                                active={localConfig.preferGraph ?? true}
                                                onToggle={() => setLocalConfig(prev => ({ ...prev, preferGraph: !(prev.preferGraph ?? true) }))}
                                            />
                                            <div className="h-px bg-gray-200 dark:bg-gray-800" />
                                            <ToggleRow
                                                label="Offline Mode"
                                                desc="Disable all live web searches. Only use data from Graph-Lite and ingested Catalogs."
                                                active={localConfig.offlineMode ?? false}
                                                onToggle={() => setLocalConfig(prev => ({ ...prev, offlineMode: !(prev.offlineMode ?? false) }))}
                                            />
                                        </div>
                                    </div>
                                </Section>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(['fast', 'balanced', 'deep'] as const).map(mode => (
                                        <div key={mode} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Zap className={`w-4 h-4 ${mode === 'deep' ? 'text-purple-500' : mode === 'balanced' ? 'text-blue-500' : 'text-amber-500'}`} />
                                                <h4 className="font-bold capitalize text-gray-900 dark:text-white">{t(`settings:modes.${mode}`)}</h4>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-400">{t('settings:modes.max_queries')}</label>
                                                    <input
                                                        type="number"
                                                        value={localConfig.budgets[mode].maxQueries}
                                                        onChange={(e) => setLocalConfig({ ...localConfig, budgets: { ...localConfig.budgets, [mode]: { ...localConfig.budgets[mode], maxQueries: parseInt(e.target.value) || 0 } } })}
                                                        className="w-full mt-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-400">{t('settings:modes.limit_per_query')}</label>
                                                    <input
                                                        type="number"
                                                        value={localConfig.budgets[mode].limitPerQuery}
                                                        onChange={(e) => setLocalConfig({ ...localConfig, budgets: { ...localConfig.budgets, [mode]: { ...localConfig.budgets[mode], limitPerQuery: parseInt(e.target.value) || 0 } } })}
                                                        className="w-full mt-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'sources' && (
                            <div className="space-y-8 max-w-2xl animate-in slide-in-from-right-4 duration-300">
                                <Section title={t('settings:sources.allowed_types')}>
                                    <div className="grid grid-cols-1 gap-3">
                                        <SourceCard
                                            label={t('settings:sources.official')}
                                            desc={t('settings:sources.official_desc')}
                                            active={localConfig.sources.official}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, official: !prev.sources.official } }))}
                                            specificDomains={localConfig.sources.specificOfficial || []}
                                            onSpecificDomainsChange={(domains) => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, specificOfficial: domains } }))}
                                            placeholder="hp.com, canon.com, support.epson.ru"
                                        />
                                        <SourceCard
                                            label={t('settings:sources.marketplace')}
                                            desc={t('settings:sources.marketplace_desc')}
                                            active={localConfig.sources.marketplace}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, marketplace: !prev.sources.marketplace } }))}
                                            specificDomains={localConfig.sources.specificMarketplace || []}
                                            onSpecificDomainsChange={(domains) => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, specificMarketplace: domains } }))}
                                            placeholder="amazon.com, wildberries.ru, ozon.ru"
                                        />
                                        <SourceCard
                                            label={t('settings:sources.community')}
                                            desc={t('settings:sources.community_desc')}
                                            active={localConfig.sources.community}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, community: !prev.sources.community } }))}
                                            specificDomains={localConfig.sources.specificCommunity || []}
                                            onSpecificDomainsChange={(domains) => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, specificCommunity: domains } }))}
                                            placeholder="reddit.com, fixyourownprinter.com, startcopy.ru"
                                        />
                                    </div>
                                </Section>

                                <Section title={t('settings:sources.blocked_domains')}>
                                    <textarea
                                        value={localConfig.sources.blockedDomains.join('\n')}
                                        onChange={(e) => setLocalConfig({ ...localConfig, sources: { ...localConfig.sources, blockedDomains: e.target.value.split('\n') } })}
                                        className="w-full h-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="example.com"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">{t('settings:sources.blocked_domains_desc')}</p>
                                </Section>
                            </div>
                        )}

                        {activeTab === 'prompts' && (
                            <div className="space-y-6 max-w-4xl animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <Section title={t('settings:prompts.system_prompts')} />
                                    <button
                                        onClick={() => {
                                            const isRu = localConfig.language === 'ru';
                                            setLocalConfig({
                                                ...localConfig,
                                                prompts: {
                                                    discovery: isRu ? DEFAULT_DISCOVERY_PROMPT_RU : DEFAULT_DISCOVERY_PROMPT,
                                                    synthesis: isRu ? DEFAULT_SYNTHESIS_PROMPT_RU : DEFAULT_SYNTHESIS_PROMPT,
                                                    logistics: isRu ? DEFAULT_LOGISTICS_PROMPT_RU : DEFAULT_LOGISTICS_PROMPT
                                                }
                                            });
                                        }}
                                        className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                                    >
                                        {t('settings:prompts.reset')}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <PromptEditor
                                        label={t('settings:prompts.discovery')}
                                        value={localConfig.prompts.discovery}
                                        onChange={(v) => setLocalConfig({ ...localConfig, prompts: { ...localConfig.prompts, discovery: v } })}
                                    />
                                    <PromptEditor
                                        label={t('settings:prompts.synthesis')}
                                        value={localConfig.prompts.synthesis}
                                        onChange={(v) => setLocalConfig({ ...localConfig, prompts: { ...localConfig.prompts, synthesis: v } })}
                                    />
                                    <PromptEditor
                                        label={t('settings:prompts.logistics') || "LOGISTICS AGENT"}
                                        value={localConfig.prompts.logistics || ""}
                                        onChange={(v) => setLocalConfig({ ...localConfig, prompts: { ...localConfig.prompts, logistics: v } })}
                                    />
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f1115] flex justify-end gap-3 rounded-br-3xl">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                            {t('settings:actions.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all ${hasChanges
                                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:shadow-xl hover:-translate-y-0.5'
                                : 'bg-gray-300 dark:bg-gray-800 cursor-not-allowed text-gray-500'
                                }`}
                        >
                            <Save className="w-4 h-4" />
                            {t('settings:actions.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
