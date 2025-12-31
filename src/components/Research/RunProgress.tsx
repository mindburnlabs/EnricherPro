import React, { useEffect, useRef } from 'react';
import { Loader2, CheckCircle, Circle, Brain, Search, Database, FileCheck, Terminal, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ResearchLog } from '../../hooks/useResearchStream.js';

export interface StepStatus {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    message?: string;
}

interface RunProgressProps {
    steps: StepStatus[];
    logs?: ResearchLog[];
    isVisible: boolean;
}

export const RunProgress: React.FC<RunProgressProps> = ({ steps, logs = [], isVisible }) => {
    const { t } = useTranslation('research');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (!isVisible) return null;

    const getIcon = (status: StepStatus['status'], id: string) => {
        if (status === 'running') return <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />;
        if (status === 'completed') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        if (status === 'failed') return <FileCheck className="w-5 h-5 text-red-500" />;

        if (id.includes("plan")) return <Brain className="w-5 h-5 text-gray-300" />;
        if (id.includes("research") || id.includes("search")) return <Search className="w-5 h-5 text-gray-300" />;
        if (id.includes("extract") || id.includes("analyz") || id.includes("read")) return <Database className="w-5 h-5 text-gray-300" />;
        return <Circle className="w-5 h-5 text-gray-300" />;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Timeline Wrapper - Adapted for layout */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        {t('progress.title')}
                    </h3>
                </div>

                <div className="p-4 space-y-4">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex gap-3 items-start relative">
                            {idx !== steps.length - 1 && (
                                <div className="absolute left-2.5 top-6 bottom-[-16px] w-0.5 bg-gray-100 dark:bg-gray-700"></div>
                            )}

                            <div className="mt-0.5">{getIcon(step.status, step.id)}</div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className={`text-sm font-medium ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                        {step.label.includes('.') ? t(step.label) : step.label}
                                    </p>
                                    {step.status === 'running' && (
                                        <span className="text-xs font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded animate-pulse">Running...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Live Terminal */}
            <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800 font-mono text-xs">
                <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 border-b border-gray-700">
                    <Terminal className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400 uppercase tracking-wider text-[10px]">Live Agent Activity</span>
                    <div className="flex-1" />
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500/50" />
                        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                        <div className="w-2 h-2 rounded-full bg-green-500/50" />
                    </div>
                </div>

                <div ref={scrollRef} className="h-64 overflow-y-auto p-4 space-y-2 scroll-smooth bg-[#0d1117]">
                    <AnimatePresence initial={false}>
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex gap-3 items-start group"
                            >
                                <span className="text-gray-600 shrink-0 select-none">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <span className={`uppercase font-bold shrink-0 w-24 text-right select-none
                                    ${log.agent === 'discovery' ? 'text-blue-400' :
                                        log.agent === 'synthesis' ? 'text-purple-400' :
                                            log.agent === 'logistics' ? 'text-orange-400' :
                                                'text-gray-500'}
                                `}>
                                    {log.agent}
                                </span>
                                <span className={`break-words flex-1
                                    ${log.type === 'error' ? 'text-red-400 font-bold' :
                                        log.type === 'success' ? 'text-emerald-400' :
                                            log.type === 'warning' ? 'text-yellow-400' :
                                                'text-gray-300 group-hover:text-white transition-colors'}
                                `}>
                                    {log.message}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-700 space-y-2">
                            <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                            <p>Waiting for agent signals...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
