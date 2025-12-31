
import React, { useState, useEffect } from 'react';
import { X, Save, Moon, Sun, Globe, Brain, Zap, Key, Layout } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsViewProps {
    isOpen: boolean;
    onClose: () => void;
    onThemeChange: () => void;
    currentTheme: 'light' | 'dark';
}

type Tab = 'general' | 'api' | 'prompts' | 'modes';

export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose, onThemeChange, currentTheme }) => {
    if (!isOpen) return null;

    const { t, i18n } = useTranslation('common');
    const [activeTab, setActiveTab] = useState<Tab>('general');

    // API Keys
    const [keys, setKeys] = useState({
        firecrawl: localStorage.getItem('firecrawl_key') || '',
        google: localStorage.getItem('google_key') || '',
        openrouter: localStorage.getItem('openrouter_key') || '',
    });

    // Prompts
    const defaultDiscoveryPrompt = `You are the Lead Research Planner for a Printer Consumables Database...`; // truncated for default
    const defaultSynthesisPrompt = `You are the Synthesis Agent for the EnricherPro Consumable Database...`; // truncated

    const [prompts, setPrompts] = useState({
        discovery: localStorage.getItem('agent_prompts') ? JSON.parse(localStorage.getItem('agent_prompts')!).discovery : '',
        synthesis: localStorage.getItem('agent_prompts') ? JSON.parse(localStorage.getItem('agent_prompts')!).synthesis : ''
    });

    // Budgets
    const defaultBudgets = {
        fast: { maxQueries: 2, limitPerQuery: 3 },
        balanced: { maxQueries: 5, limitPerQuery: 5 },
        deep: { maxQueries: 12, limitPerQuery: 10 }
    };
    const [budgets, setBudgets] = useState(
        localStorage.getItem('agent_budgets')
            ? JSON.parse(localStorage.getItem('agent_budgets')!)
            : defaultBudgets
    );

    const [lang, setLang] = useState(i18n.language || 'en');

    const handleSave = () => {
        // Keys
        localStorage.setItem('firecrawl_key', keys.firecrawl);
        localStorage.setItem('google_key', keys.google);
        localStorage.setItem('openrouter_key', keys.openrouter);

        // Lang
        if (lang !== i18n.language) {
            i18n.changeLanguage(lang);
        }

        // Prompts
        localStorage.setItem('agent_prompts', JSON.stringify(prompts));

        // Budgets
        localStorage.setItem('agent_budgets', JSON.stringify(budgets));

        onClose();
    };

    const handleResetPrompts = () => {
        if (confirm("Reset all prompts to system defaults?")) {
            setPrompts({ discovery: '', synthesis: '' });
        }
    }

    const handleResetBudgets = () => {
        if (confirm("Reset all budgets to system defaults?")) {
            setBudgets(defaultBudgets);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col h-[85vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600">
                        {t('settings.title', 'Configuration')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-700">
                    <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Layout className="w-4 h-4" />} label="General" />
                    <TabButton active={activeTab === 'api'} onClick={() => setActiveTab('api')} icon={<Key className="w-4 h-4" />} label="API Keys" />
                    <TabButton active={activeTab === 'prompts'} onClick={() => setActiveTab('prompts')} icon={<Brain className="w-4 h-4" />} label="Agent Prompts" />
                    <TabButton active={activeTab === 'modes'} onClick={() => setActiveTab('modes')} icon={<Zap className="w-4 h-4" />} label="Research Modes" />
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">

                    {activeTab === 'general' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                            <h3 className="section-title">Appearance & Interface</h3>
                            <div className="setting-card">
                                <div className="flex items-center gap-3">
                                    {currentTheme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                                    <span className="setting-label">Theme</span>
                                </div>
                                <button onClick={onThemeChange} className="btn-secondary">
                                    {currentTheme === 'light' ? 'Light Mode' : 'Dark Mode'}
                                </button>
                            </div>
                            <div className="setting-card">
                                <div className="flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-emerald-500" />
                                    <span className="setting-label">Language</span>
                                </div>
                                <select value={lang} onChange={(e) => setLang(e.target.value)} className="input-select">
                                    <option value="en">English</option>
                                    <option value="ru">Русский</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                            <h3 className="section-title">Bring Your Own Key</h3>
                            <p className="text-sm text-gray-500 mb-4">Keys are stored locally in your browser and override server defaults.</p>
                            <InputField label="Firecrawl API Key" value={keys.firecrawl} onChange={v => setKeys({ ...keys, firecrawl: v })} placeholder="fc-..." />
                            <InputField label="OpenRouter API Key" value={keys.openrouter} onChange={v => setKeys({ ...keys, openrouter: v })} placeholder="sk-or-..." />
                            <InputField label="Google Gemini API Key" value={keys.google} onChange={v => setKeys({ ...keys, google: v })} placeholder="AIza..." />
                        </div>
                    )}

                    {activeTab === 'prompts' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                            <div className="flex justify-between items-center">
                                <h3 className="section-title">Agent System Prompts</h3>
                                <button onClick={handleResetPrompts} className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Reset Defaults</button>
                            </div>

                            <TextAreaField
                                label="Discovery Agent (Planner)"
                                value={prompts.discovery}
                                onChange={v => setPrompts({ ...prompts, discovery: v })}
                                placeholder="Default: You are the Lead Research Planner..."
                                h="h-48"
                            />

                            <TextAreaField
                                label="Synthesis Agent (Extractor)"
                                value={prompts.synthesis}
                                onChange={v => setPrompts({ ...prompts, synthesis: v })}
                                placeholder="Default: You are the Synthesis Agent..."
                                h="h-64"
                            />
                        </div>
                    )}

                    {activeTab === 'modes' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                            <div className="flex justify-between items-center">
                                <h3 className="section-title">Mode Resource Budgets</h3>
                                <button onClick={handleResetBudgets} className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Reset Defaults</button>
                            </div>

                            {(['fast', 'balanced', 'deep'] as const).map(mode => (
                                <div key={mode} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <h4 className="font-bold text-emerald-600 capitalize mb-3">{mode} Mode</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField
                                            label="Max Queries"
                                            type="number"
                                            value={String(budgets[mode].maxQueries)}
                                            onChange={v => setBudgets({ ...budgets, [mode]: { ...budgets[mode], maxQueries: parseInt(v) || 0 } })}
                                            placeholder="5"
                                        />
                                        <InputField
                                            label="Results Per Query"
                                            type="number"
                                            value={String(budgets[mode].limitPerQuery)}
                                            onChange={v => setBudgets({ ...budgets, [mode]: { ...budgets[mode], limitPerQuery: parseInt(v) || 0 } })}
                                            placeholder="5"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end gap-3 z-10">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">
                        <Save className="w-4 h-4" />
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${active ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
        {icon}
        {label}
    </button>
);

const InputField = ({ label, value, onChange, placeholder, type = 'text' }: any) => (
    <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm"
        />
    </div>
);

const TextAreaField = ({ label, value, onChange, placeholder, h = 'h-32' }: any) => (
    <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block">{label}</label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full p-4 bg-gray-900 text-gray-100 border border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-xs leading-relaxed ${h} resize-y`}
        />
    </div>
);

// CSS Helpers as Tailwind classes
const classes = {
    sectionTitle: "text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2",
    settingCard: "flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700",
    settingLabel: "font-medium text-gray-700 dark:text-gray-300",
    btnSecondary: "px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg",
    btnPrimary: "px-6 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95",
    inputSelect: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
};

