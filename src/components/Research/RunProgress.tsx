import React from 'react';
import { Loader2, CheckCircle, Circle, Brain, Search, Database, FileCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface StepStatus {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    message?: string;
}

interface RunProgressProps {
    steps: StepStatus[];
    isVisible: boolean;
}

export const RunProgress: React.FC<RunProgressProps> = ({ steps, isVisible }) => {
    const { t } = useTranslation('research');

    if (!isVisible) return null;

    const getIcon = (status: StepStatus['status'], id: string) => {
        if (status === 'running') return <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />;
        if (status === 'completed') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        if (status === 'failed') return <FileCheck className="w-5 h-5 text-red-500" />;

        // Default Pending Icons based on Semantic ID
        if (id.includes("plan")) return <Brain className="w-5 h-5 text-gray-300" />;
        if (id.includes("research") || id.includes("search")) return <Search className="w-5 h-5 text-gray-300" />;
        if (id.includes("extract") || id.includes("analyz") || id.includes("read")) return <Database className="w-5 h-5 text-gray-300" />;
        return <Circle className="w-5 h-5 text-gray-300" />;
    };

    return (
        <div className="fixed  left-0 md:left-6 bottom-6 md:bottom-auto md:top-24 z-50 w-full md:w-80 p-4 transition-all duration-500 ease-out transform translate-y-0">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        {t('progress.title')}
                    </h3>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex gap-3 items-start relative">
                            {/* Vertical Line */}
                            {idx !== steps.length - 1 && (
                                <div className="absolute left-2.5 top-6 bottom-[-16px] w-0.5 bg-gray-100 dark:bg-gray-700"></div>
                            )}

                            <div className="mt-0.5">
                                {getIcon(step.status, step.id)}
                            </div>
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {/* Attempt to translate key, if missing fallback to label itself */}
                                    {step.label.includes('.') ? t(step.label) : step.label}
                                </p>
                                {step.message && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{step.message}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
