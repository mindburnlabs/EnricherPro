import React, { useState, useEffect } from 'react';
import { ChevronDown, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { StepStatus } from '../../types/domain.js';
import { ResearchLog } from '../../hooks/useResearchStream.js';

interface ThinkingBlockProps {
    steps: StepStatus[];
    logs: ResearchLog[];
    status: 'running' | 'completed' | 'failed';
    isExpandedDefault?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ steps, logs, status, isExpandedDefault = false }) => {
    const [isExpanded, setIsExpanded] = useState(isExpandedDefault || status === 'running');
    const [elapsed, setElapsed] = useState(0);

    // Timer for running state
    useEffect(() => {
        if (status === 'running') {
            const timer = setInterval(() => setElapsed(e => e + 0.1), 100);
            return () => clearInterval(timer);
        }
    }, [status]);

    const activeStep = steps.find(s => s.status === 'running') || steps[steps.length - 1];

    // Calculate stats
    const stepCount = steps.length;
    const completedCount = steps.filter(s => s.status === 'completed').length;
    const sourcesFound = logs.filter(l => l.message.match(/found|source/i)).length;

    return (
        <div className="my-6 border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden bg-gray-50/30 dark:bg-gray-800/20 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/30 dark:hover:border-emerald-500/20 group">
            {/* Header / Summary */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/50 dark:hover:bg-gray-800/30 transition-colors"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
                        {status === 'running' ? (
                            <>
                                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin absolute" />
                                <Sparkles className="w-3 h-3 text-emerald-400 absolute opacity-0 animate-[ping_2s_ease-in-out_infinite]" />
                            </>
                        ) : status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                    </div>

                    <div className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            {status === 'running' ? activeStep?.label || 'Thinking...' : 'Research Complete'}
                            {status === 'running' && (
                                <span className="text-xs font-mono text-gray-400 font-normal ml-1">
                                    {elapsed.toFixed(1)}s
                                </span>
                            )}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">
                            {completedCount} steps &bull; {sourcesFound} sources found
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Badge for phase */}
                    {activeStep && status === 'running' && (
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                            {activeStep.id.replace('_', ' ')}
                        </span>
                    )}

                    <div className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </button>

            {/* Details Content */}
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700/30 space-y-6">

                        {/* Interactive Steps Timeline */}
                        <div className="mt-4 relative pl-2 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100 dark:before:bg-gray-800">
                            {steps.map((step) => {
                                const isCurrent = step.status === 'running';
                                const isDone = step.status === 'completed';

                                return (
                                    <div key={step.id} className="relative pl-8 flex flex-col gap-1 group/step">
                                        <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 bg-white dark:bg-gray-900
                                            ${isDone ? 'border-emerald-500 text-emerald-500' : isCurrent ? 'border-emerald-500 text-emerald-500' : 'border-gray-200 dark:border-gray-700 text-gray-300'}
                                        `}>
                                            {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : isCurrent ? <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />}
                                        </div>

                                        <span className={`text-sm font-medium transition-colors ${isCurrent ? 'text-emerald-600 dark:text-emerald-400' : isDone ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                                            {step.label}
                                        </span>

                                        {/* Show relevant logs for this step if running */}
                                        {isCurrent && (
                                            <div className="text-xs font-mono text-gray-500 dark:text-gray-500 mt-1 pl-1 border-l-2 border-gray-100 dark:border-gray-800 ml-1 py-1">
                                                {logs.slice(-2).map(l => (
                                                    <div key={l.id} className="truncate opacity-75">{l.message}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
