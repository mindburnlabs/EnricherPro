
import React, { useState } from 'react';
import { Send, Paperclip, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ResearchComposerProps {
    onSubmit: (input: string) => void;
    isProcessing: boolean;
}

export const ResearchComposer: React.FC<ResearchComposerProps> = ({ onSubmit, isProcessing }) => {
    const { t } = useTranslation('research');
    const [input, setInput] = useState('');

    const suggestions = [
        t('composer.suggestions.1'),
        t('composer.suggestions.2'),
        t('composer.suggestions.3')
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isProcessing) {
            onSubmit(input);
            setInput('');
        }
    };

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
                        <div className="flex space-x-2">
                            <button type="button" className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors">
                                <Paperclip className="w-5 h-5" />
                            </button>
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
