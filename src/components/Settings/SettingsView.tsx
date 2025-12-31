
import React, { useState, useEffect } from 'react';
import { X, Save, Moon, Sun, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsViewProps {
    isOpen: boolean;
    onClose: () => void;
    onThemeChange: () => void;
    currentTheme: 'light' | 'dark';
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isOpen, onClose, onThemeChange, currentTheme }) => {
    if (!isOpen) return null;

    const { t, i18n } = useTranslation('common');
    const [keys, setKeys] = useState({
        firecrawl: localStorage.getItem('firecrawl_key') || '',
        google: localStorage.getItem('google_key') || '',
        openrouter: localStorage.getItem('openrouter_key') || '',
    });

    const [lang, setLang] = useState(i18n.language || 'en');

    const handleSave = () => {
        localStorage.setItem('firecrawl_key', keys.firecrawl);
        localStorage.setItem('google_key', keys.google);
        localStorage.setItem('openrouter_key', keys.openrouter);

        if (lang !== i18n.language) {
            i18n.changeLanguage(lang);
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600">
                        {t('settings.title', 'Settings')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8 flex-1">

                    {/* Appearance */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                            {t('settings.appearance', 'Appearance')}
                        </h3>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                {currentTheme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {currentTheme === 'light' ? 'Light Mode' : 'Dark Mode'}
                                </span>
                            </div>
                            <button
                                onClick={onThemeChange}
                                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                            >
                                {t('settings.toggle', 'Toggle')}
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <Globe className="w-5 h-5 text-emerald-500" />
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {t('settings.language', 'Language')}
                                </span>
                            </div>
                            <select
                                value={lang}
                                onChange={(e) => setLang(e.target.value)}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="en">English</option>
                                <option value="ru">Русский</option>
                            </select>
                        </div>
                    </section>

                    {/* API Keys */}
                    <section className="space-y-4">
                        <div className='flex items-center justify-between'>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                                {t('settings.api_keys', 'API Configuration')}
                            </h3>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Stored Locally</span>
                        </div>

                        <div className="space-y-3">
                            <InputField
                                label="Firecrawl API Key"
                                value={keys.firecrawl}
                                onChange={v => setKeys(prev => ({ ...prev, firecrawl: v }))}
                                placeholder="fc-..."
                            />
                            <InputField
                                label="OpenRouter API Key"
                                value={keys.openrouter}
                                onChange={v => setKeys(prev => ({ ...prev, openrouter: v }))}
                                placeholder="sk-or-..."
                            />
                            <InputField
                                label="Google Gemini API Key"
                                value={keys.google}
                                onChange={v => setKeys(prev => ({ ...prev, google: v }))}
                                placeholder="AIza..."
                            />
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                            Leave blank to use server defaults (env vars).
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        {t('common.save', 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const InputField = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (val: string) => void, placeholder: string }) => (
    <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pl-1">{label}</label>
        <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm"
        />
    </div>
);
