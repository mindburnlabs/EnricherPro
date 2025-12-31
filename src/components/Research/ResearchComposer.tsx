import React, { useState } from 'react';
import { Send, Paperclip, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ResearchComposerProps {
    onSubmit: (input: string | string[], mode: 'fast' | 'balanced' | 'deep', isRefinement?: boolean) => void;
    isProcessing: boolean;
    canRefine?: boolean; // New prop
}

export const ResearchComposer: React.FC<ResearchComposerProps> = ({ onSubmit, isProcessing, canRefine }) => {
    const { t } = useTranslation('research');
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'fast' | 'balanced' | 'deep'>('balanced');
    const [showModes, setShowModes] = useState(false);
    const [isRefining, setIsRefining] = useState(false); // Toggle for refinement mode

    // Reset refining state if canRefine changes to false
    React.useEffect(() => {
        if (!canRefine) setIsRefining(false);
    }, [canRefine]);

    const suggestions = [
        t('composer.suggestions.1'),
        t('composer.suggestions.2'),
        t('composer.suggestions.3')
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isProcessing) {
            const lines = input.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 1) {
                onSubmit(lines, mode, false);
            } else {
                onSubmit(lines[0], mode, isRefining);
            }
            setInput('');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Dynamic import to avoid SSR issues if any, mostly just cleaner
        import('papaparse').then((Papa) => {
            Papa.parse(file, {
                complete: (results) => {
                    const data = results.data as string[][];
                    const flatList: string[] = [];
                    data.forEach(row => {
                        if (row[0] && row[0].trim()) flatList.push(row[0].trim());
                    });
                    if (flatList.length > 0) {
                        setInput(flatList.join('\n'));
                    }
                },
                header: false
            });
        });
    };

    const modes = [
        { id: 'fast', label: '⚡ Fast', desc: 'Quick specs check' },
        { id: 'balanced', label: '⚖️ Balanced', desc: 'Scrape & Verify' },
        { id: 'deep', label: '🧠 Deep', desc: 'Exhaustive (Slow)' }
    ];

    return (
        <div className="w-full max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
                <div className={`
                    flex flex-col bg-white dark:bg-gray-800 
                    border border-gray-200 dark:border-gray-700
                    rounded-[32px] shadow-lg transition-all duration-300 
                    relative z-10 overflow-hidden
                    focus-within:shadow-xl focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/10
                    ${isRefining ? 'border-purple-200 dark:border-purple-800/50 focus-within:border-purple-500/50 focus-within:ring-purple-500/10' : ''}
                `}>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isRefining ? "Ask a follow-up..." : t('composer.placeholder')}
                        className="w-full min-h-[80px] p-5 pb-12 bg-transparent text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none font-medium leading-relaxed"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />

                    {/* Bottom Toolbar */}
                    <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            {/* Focus / Mode Selector */}
                            <button
                                type="button"
                                onClick={() => setShowModes(!showModes)}
                                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                {mode === 'fast' && <span>⚡</span>}
                                {mode === 'balanced' && <span>⚖️</span>}
                                {mode === 'deep' && <span>🧠</span>}
                                <span>{modes.find(m => m.id === mode)?.label.split(' ')[1]}</span>
                            </button>

                            {/* Refine Toggle */}
                            {canRefine && (
                                <button
                                    type="button"
                                    onClick={() => setIsRefining(!isRefining)}
                                    className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${isRefining
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                        : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200'}`}
                                >
                                    <span>✨ Refine</span>
                                </button>
                            )}

                            <label className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" title="Upload">
                                <Paperclip className="w-4 h-4" />
                                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Word Count / Ready State? */}
                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!input.trim() || isProcessing}
                                className={`p-2 rounded-full text-white transition-all transform duration-200 shadow-md flex items-center justify-center
                                    ${input.trim() && !isProcessing
                                        ? (isRefining ? 'bg-purple-600 hover:bg-purple-500 scale-100' : 'bg-emerald-600 hover:bg-emerald-500 scale-100')
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 scale-95 cursor-not-allowed shadow-none'}`}
                            >
                                {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                            </button>
                        </div>
                    </div>

                    {/* Mode Dropdown */}
                    {showModes && (
                        <div className="absolute bottom-14 left-4 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 p-1">
                            {modes.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => { setMode(m.id as any); setShowModes(false); }}
                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors flex items-center gap-3 ${mode === m.id ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}
                                >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm text-base">
                                        {m.label.split(' ')[0]}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`font-semibold ${mode === m.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {m.label.split(' ').slice(1).join(' ')}
                                        </span>
                                        <span className="text-[10px] text-gray-500">{m.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </form>

            {!isRefining && (
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => setInput(suggestion)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 rounded-xl transition-all hover:-translate-y-0.5"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
