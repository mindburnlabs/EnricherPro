import React, { useState, useEffect } from 'react';
import { X, Save, Moon, Sun, Globe, Brain, Zap, Key, Layout, Shield, Database, Check, History, ChevronRight, AlertCircle, RefreshCw, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ResearchConfig } from '../../hooks/useResearchConfig.js';

interface SettingsViewProps {
    isOpen: boolean;
    onClose: () => void;
    onThemeChange: () => void;
    currentTheme: 'light' | 'dark';
    config: ResearchConfig;
    onSave: (newConfig: Partial<ResearchConfig>) => void;
}

type Tab = 'general' | 'models' | 'api' | 'prompts' | 'modes' | 'sources';

export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose, onThemeChange, currentTheme, config, onSave }) => {
    if (!isOpen) return null;

    const { t, i18n } = useTranslation('common');
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [localConfig, setLocalConfig] = useState<ResearchConfig>(config);
    const [hasChanges, setHasChanges] = useState(false);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [availableModels, setAvailableModels] = useState<any[]>([]);

    useEffect(() => {
        setLocalConfig(config);
        setHasChanges(false);
    }, [config]);

    // Detect changes
    useEffect(() => {
        const isDifferent = JSON.stringify(config) !== JSON.stringify(localConfig);
        setHasChanges(isDifferent);
    }, [localConfig, config]);

    const handleSave = () => {
        onSave(localConfig);
        if (localConfig.lang !== i18n.language) {
            i18n.changeLanguage(localConfig.lang);
        }
        setHasChanges(false);
        onClose();
    };

    const fetchModels = async () => {
        if (!localConfig.apiKeys.openrouter) {
            alert("Please save an OpenRouter API Key first.");
            return;
        }
        setIsFetchingModels(true);
        try {
            const res = await fetch('https://openrouter.ai/api/v1/models');
            const data = await res.json();
            if (data.data) {
                // Filter for reasonable models to avoid overwhelming the user (e.g. context > 4k)
                const models = data.data.sort((a: any, b: any) => a.id.localeCompare(b.id));
                setAvailableModels(models);
            }
        } catch (e) {
            alert("Failed to fetch models");
        } finally {
            setIsFetchingModels(false);
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'general', label: 'General', icon: <Layout className="w-4 h-4" /> },
        { id: 'models', label: 'Models', icon: <Database className="w-4 h-4" /> },
        { id: 'api', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
        { id: 'modes', label: 'Research Modes', icon: <Zap className="w-4 h-4" /> },
        { id: 'sources', label: 'Sources', icon: <Shield className="w-4 h-4" /> },
        { id: 'prompts', label: 'Agent Prompts', icon: <Brain className="w-4 h-4" /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-[#0f1115] w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex overflow-hidden border border-gray-200 dark:border-gray-800">

                {/* Sidebar */}
                <div className="w-64 bg-gray-50/50 dark:bg-black/20 border-r border-gray-200 dark:border-gray-800 flex flex-col pt-6 pb-4">
                    <div className="px-6 mb-8">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                        <p className="text-xs text-gray-500 mt-1">Manage your research agent</p>
                    </div>

                    <nav className="flex-1 px-3 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                    }`}
                            >
                                <span className={activeTab === tab.id ? 'text-emerald-500' : 'text-gray-400'}>{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-400" />}
                            </button>
                        ))}
                    </nav>

                    <div className="px-6 mt-auto">
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
                            <Wand2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Pro Plan Active</span>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1115]">
                    {/* Header for Mobile/Context */}
                    <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#0f1115] sticky top-0 z-10">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tabs.find(t => t.id === activeTab)?.label}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Configure global preferences and API connections</p>
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
                                <Section title="Appearance">
                                    <div className="grid grid-cols-2 gap-4">
                                        <ThemeCard
                                            active={currentTheme === 'light'}
                                            onClick={() => currentTheme !== 'light' && onThemeChange()}
                                            icon={<Sun className="w-5 h-5" />}
                                            label="Light Mode"
                                        />
                                        <ThemeCard
                                            active={currentTheme === 'dark'}
                                            onClick={() => currentTheme !== 'dark' && onThemeChange()}
                                            icon={<Moon className="w-5 h-5" />}
                                            label="Dark Mode"
                                        />
                                    </div>
                                </Section>

                                <Section title="Localization">
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                                <Globe className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">Interface Language</div>
                                                <div className="text-xs text-gray-500">Affects UI text and default search regions</div>
                                            </div>
                                        </div>
                                        <select
                                            value={localConfig.lang}
                                            onChange={(e) => setLocalConfig({ ...localConfig, lang: e.target.value })}
                                            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="en">English (US)</option>
                                            <option value="ru">Русский</option>
                                        </select>
                                    </div>
                                </Section>
                            </div>
                        )}

                        {activeTab === 'models' && (
                            <div className="space-y-6 max-w-2xl animate-in slide-in-from-right-4 duration-300">
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900/30">
                                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Database className="w-5 h-5 text-emerald-600" />
                                        Primary Reasoner Model
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 mb-4">
                                        Select the LLM used for planning, synthesis, and reasoning. Requires OpenRouter key.
                                    </p>

                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-white dark:bg-black border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
                                            <span className="font-mono text-sm">{localConfig.model}</span>
                                            <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Active</span>
                                        </div>
                                        <button
                                            onClick={fetchModels}
                                            disabled={isFetchingModels}
                                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            {isFetchingModels ? <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" /> : <RefreshCw className="w-5 h-5 text-gray-500" />}
                                        </button>
                                    </div>

                                    {availableModels.length > 0 && (
                                        <div className="mt-4 max-h-64 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                                            {availableModels.map(model => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => setLocalConfig({ ...localConfig, model: model.id })}
                                                    className={`w-full text-left px-4 py-3 text-xs font-mono border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 flex justify-between ${localConfig.model === model.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}
                                                >
                                                    {model.id}
                                                    {localConfig.model === model.id && <Check className="w-3 h-3" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {availableModels.length === 0 && !isFetchingModels && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            Click the refresh button to load available models from OpenRouter.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'api' && (
                            <div className="space-y-6 max-w-2xl animate-in slide-in-from-right-4 duration-300">
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl p-4 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                        API keys are stored securely in your browser's LocalStorage. They are never sent to our servers, only directly to the providers.
                                    </p>
                                </div>

                                <InputGroup
                                    label="Firecrawl API Key"
                                    desc="Required for web scraping and search"
                                    value={localConfig.apiKeys.firecrawl}
                                    onChange={(v) => setLocalConfig({ ...localConfig, apiKeys: { ...localConfig.apiKeys, firecrawl: v } })}
                                    placeholder="fc-..."
                                    type="password"
                                />
                                <InputGroup
                                    label="OpenRouter API Key"
                                    desc="Required for LLM reasoning models"
                                    value={localConfig.apiKeys.openrouter}
                                    onChange={(v) => setLocalConfig({ ...localConfig, apiKeys: { ...localConfig.apiKeys, openrouter: v } })}
                                    placeholder="sk-or-..."
                                    type="password"
                                />
                                <InputGroup
                                    label="Google Gemini API Key"
                                    desc="Optional backup model provider"
                                    value={localConfig.apiKeys.google}
                                    onChange={(v) => setLocalConfig({ ...localConfig, apiKeys: { ...localConfig.apiKeys, google: v } })}
                                    placeholder="AIza..."
                                    type="password"
                                />
                            </div>
                        )}

                        {activeTab === 'modes' && (
                            <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(['fast', 'balanced', 'deep'] as const).map(mode => (
                                        <div key={mode} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Zap className={`w-4 h-4 ${mode === 'deep' ? 'text-purple-500' : mode === 'balanced' ? 'text-blue-500' : 'text-amber-500'}`} />
                                                <h4 className="font-bold capitalize text-gray-900 dark:text-white">{mode}</h4>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-400">Max Queries</label>
                                                    <input
                                                        type="number"
                                                        value={localConfig.budgets[mode].maxQueries}
                                                        onChange={(e) => setLocalConfig({ ...localConfig, budgets: { ...localConfig.budgets, [mode]: { ...localConfig.budgets[mode], maxQueries: parseInt(e.target.value) || 0 } } })}
                                                        className="w-full mt-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-400">Depth Limit</label>
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
                                <Section title="Allowed Source Types">
                                    <div className="grid grid-cols-1 gap-3">
                                        <ToggleRow
                                            label="Official Sources"
                                            desc="Brand websites, documentation, and verified portals."
                                            active={localConfig.sources.allowedTypes.official}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, allowedTypes: { ...prev.sources.allowedTypes, official: !prev.sources.allowedTypes.official } } }))}
                                        />
                                        <ToggleRow
                                            label="Marketplaces"
                                            desc="E-commerce sites like Amazon, eBay, Newegg."
                                            active={localConfig.sources.allowedTypes.marketplaces}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, allowedTypes: { ...prev.sources.allowedTypes, marketplaces: !prev.sources.allowedTypes.marketplaces } } }))}
                                        />
                                        <ToggleRow
                                            label="Community & Forums"
                                            desc="Reddit, StackExchange, and niche discussion boards."
                                            active={localConfig.sources.allowedTypes.community}
                                            onToggle={() => setLocalConfig(prev => ({ ...prev, sources: { ...prev.sources, allowedTypes: { ...prev.sources.allowedTypes, community: !prev.sources.allowedTypes.community } } }))}
                                        />
                                    </div>
                                </Section>

                                <Section title="Blocked Domains">
                                    <textarea
                                        value={localConfig.sources.blockedDomains.join('\n')}
                                        onChange={(e) => setLocalConfig({ ...localConfig, sources: { ...localConfig.sources, blockedDomains: e.target.value.split('\n') } })}
                                        className="w-full h-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="example.com"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Enter one domain per line to exclude from research.</p>
                                </Section>
                            </div>
                        )}

                        {activeTab === 'prompts' && (
                            <div className="space-y-6 max-w-4xl animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <Section title="System Prompts" />
                                    <button
                                        onClick={() => setLocalConfig(prev => ({ ...prev, prompts: { discovery: '', synthesis: '' } }))}
                                        className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                                    >
                                        at Reset Defaults
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <PromptEditor
                                        label="Discovery Agent"
                                        value={localConfig.prompts.discovery}
                                        onChange={(v) => setLocalConfig({ ...localConfig, prompts: { ...localConfig.prompts, discovery: v } })}
                                    />
                                    <PromptEditor
                                        label="Synthesis Agent"
                                        value={localConfig.prompts.synthesis}
                                        onChange={(v) => setLocalConfig({ ...localConfig, prompts: { ...localConfig.prompts, synthesis: v } })}
                                    />
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f1115] flex justify-end gap-3 rounded-br-3xl">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            Cancel
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
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

