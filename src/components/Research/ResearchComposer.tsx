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
            <form onSubmit={handleSubmit} className="relative group z-20">
                <div className={`
                    flex flex-col bg-white dark:bg-gray-800 
                    border border-gray-200 dark:border-gray-700
                    rounded-[26px] shadow-sm transition-all duration-300 
                    relative
                    focus-within:shadow-2xl focus-within:border-emerald-500/30 focus-within:ring-4 focus-within:ring-emerald-500/5
                    ${isRefining ? 'border-purple-200 dark:border-purple-800/50 focus-within:border-purple-500/30 focus-within:ring-purple-500/5' : ''}
                `}>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isRefining ? "Ask a follow-up question..." : t('composer.placeholder')}
                        className="w-full min-h-[72px] p-5 pb-14 bg-transparent text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none font-medium leading-relaxed rounded-[26px]"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />

                    {/* Bottom Toolbar */}
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            {/* Mode Selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowModes(!showModes)}
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 border
                                        ${showModes
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50'
                                            : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}
                                    `}
                                >
                                    <span className="text-base">
                                        {mode === 'fast' && '⚡'}
                                        {mode === 'balanced' && '⚖️'}
                                        {mode === 'deep' && '🧠'}
                                    </span>
                                    <span className="hidden sm:inline">{modes.find(m => m.id === mode)?.label.split(' ')[1]}</span>
                                </button>

                                {/* Dropdown Menu - Positioned Absolute/Z-Index High */}
                                {showModes && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setShowModes(false)} />
                                        <div className="absolute bottom-full mb-3 left-0 w-64 bg-white dark:bg-[#1a1c20] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
                                            <div className="p-1 space-y-0.5">
                                                {modes.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => { setMode(m.id as any); setShowModes(false); }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-start gap-3 group
                                                            ${mode === m.id
                                                                ? 'bg-emerald-50/50 dark:bg-emerald-500/10'
                                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                                            }`}
                                                    >
                                                        <div className={`
                                                            flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-base transition-colors
                                                            ${mode === m.id
                                                                ? 'bg-emerald-100/50 dark:bg-emerald-500/20'
                                                                : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700'}
                                                        `}>
                                                            {m.label.split(' ')[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className={`text-sm font-semibold ${mode === m.id ? 'text-emerald-900 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                                    {m.label.split(' ').slice(1).join(' ')}
                                                                </span>
                                                                {mode === m.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />}
                                                            </div>
                                                            <span className={`text-[11px] ${mode === m.id ? 'text-emerald-700/80 dark:text-emerald-400/70' : 'text-gray-500'}`}>
                                                                {m.desc}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Refine Toggle */}
                            {canRefine && (
                                <button
                                    type="button"
                                    onClick={() => setIsRefining(!isRefining)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 border
                                        ${isRefining
                                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/50'
                                            : 'text-gray-500 dark:text-gray-400 bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'}
                                    `}
                                >
                                    <span className={isRefining ? 'animate-pulse' : ''}>✨</span>
                                    <span>Refine</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50 active:scale-95 duration-200" title="Upload Context">
                                <Paperclip className="w-4 h-4" />
                                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                            </label>

                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

                            <button
                                type="submit"
                                disabled={!input.trim() || isProcessing}
                                className={`p-2 rounded-full text-white transition-all duration-300 shadow-md flex items-center justify-center group
                                    ${input.trim() && !isProcessing
                                        ? (isRefining
                                            ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 hover:shadow-purple-500/25 hover:scale-105 active:scale-95'
                                            : 'bg-gradient-to-tr from-emerald-500 to-teal-500 hover:shadow-emerald-500/25 hover:scale-105 active:scale-95')
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 shadow-none cursor-not-allowed scale-95'}`}
                            >
                                {isProcessing ? (
                                    <div className="w-4 h-4 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4 ml-0.5" />
                                )}
                            </button>
                        </div>
                    </div>
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
