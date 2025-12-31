
import React, { useState } from 'react';
import { Send, Paperclip, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ResearchComposerProps {
    onSubmit: (input: string | string[], mode: 'fast' | 'balanced' | 'deep') => void;
    isProcessing: boolean;
}

export const ResearchComposer: React.FC<ResearchComposerProps> = ({ onSubmit, isProcessing }) => {
    const { t } = useTranslation('research');
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'fast' | 'balanced' | 'deep'>('balanced');
    const [showModes, setShowModes] = useState(false);

    const suggestions = [
        t('composer.suggestions.1'),
        t('composer.suggestions.2'),
        t('composer.suggestions.3')
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isProcessing) {
            // Split by newline and filter empty
            const lines = input.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 1) {
                // Batch
                onSubmit(lines, mode);
            } else {
                // Single
                onSubmit(lines[0], mode);
            }
            setInput('');
        }
    };

    const modes = [
        { id: 'fast', label: '⚡ Fast', desc: 'Quick specs check' },
        { id: 'balanced', label: '⚖️ Balanced', desc: 'Scrape & Verify' },
        { id: 'deep', label: '🧠 Deep', desc: 'Exhaustive (Slow)' }
    ];

    return (
        <div className="w-full max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
                <div className="flex flex-col bg-white dark:bg-gray-800 border-2 border-transparent focus-within:border-emerald-500/50 rounded-2xl shadow-xl transition-all duration-300 overflow-hidden relative z-10">

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('composer.placeholder')}
                        className="w-full min-h-[120px] p-4 bg-transparent text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none font-medium"
                    />

                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex space-x-2 relative">
                            <button
                                type="button"
                                onClick={() => setShowModes(!showModes)}
                                className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                            >
                                <span>{modes.find(m => m.id === mode)?.label}</span>
                            </button>

                            {showModes && (
                                <div className="absolute bottom-12 left-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                    {modes.map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => { setMode(m.id as any); setShowModes(false); }}
                                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col ${mode === m.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                                        >
                                            <span className={`font-semibold ${mode === m.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}>{m.label}</span>
                                            <span className="text-xs text-gray-500">{m.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Legacy clip button - kept for layout but hidden/disabled or we repurpose? Let's hide for now to declutter */}
                            {/* <button type="button" className="p-2 text-gray-500 hover:text-emerald-600 ..."><Paperclip ... /></button> */}
                        </div>

                        <button
                            type="submit"
                            disabled={!input.trim() || isProcessing}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-white font-medium transition-all transform duration-200
                ${input.trim() && !isProcessing
                                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 translate-y-0'
                                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'}`}
                        >
                            <span>{t('composer.button')}</span>
                            <div className={`p-1 rounded-full ${input.trim() ? 'bg-white/20' : ''}`}>
                                <Send className="w-4 h-4" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Glow Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl opacity-20 group-focus-within:opacity-50 blur transition duration-500 -z-10"></div>
            </form>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        </div>
    );
};
