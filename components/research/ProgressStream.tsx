
import React from 'react';
import { ResearchStep } from '../../hooks/useAgentResearch';

interface ProgressStreamProps {
    steps: ResearchStep[];
}

export const ProgressStream: React.FC<ProgressStreamProps> = ({ steps }) => {
    if (steps.length === 0) return null;

    return (
        <div className="w-full max-w-3xl mx-auto my-6 relative">
            {/* Main timeline line */}
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-800"></div>

            <div className="space-y-4">
                {steps.map((step, idx) => {
                    const isRoot = (step.depth || 0) === 0;
                    return (
                        <div
                            key={idx}
                            className={`flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-10 ${!isRoot ? 'ml-8' : ''
                                }`}
                        >
                            {/* Connector for child nodes */}
                            {!isRoot && (
                                <div className="absolute -left-[22px] top-3 w-4 h-px bg-gray-700"></div>
                            )}

                            <div className="mt-1 shrink-0 bg-[#0A0A0A] p-0.5"> {/* Background mask for timeline line */}
                                {step.status === 'running' ? (
                                    <div className={`rounded-full border-2 border-blue-500 border-t-transparent animate-spin ${isRoot ? 'h-6 w-6' : 'h-4 w-4'}`}></div>
                                ) : step.status === 'completed' ? (
                                    <div className={`rounded-full bg-green-900/50 border border-green-500 flex items-center justify-center text-green-400 ${isRoot ? 'h-6 w-6' : 'h-4 w-4'}`}>
                                        <svg className={`${isRoot ? 'w-4 h-4' : 'w-2.5 h-2.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : (
                                    <div className={`rounded-full bg-gray-700 ${isRoot ? 'h-6 w-6' : 'h-4 w-4'}`}></div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className={`truncate ${isRoot ? 'text-base font-medium text-white' : 'text-sm text-gray-400'
                                    } ${step.status === 'running' ? 'animate-pulse' : ''}`}>
                                    {step.label}
                                </p>
                                {step.details && (
                                    <p className={`text-xs mt-0.5 font-mono ${step.status === 'running' ? 'text-blue-400' : 'text-gray-500'
                                        }`}>
                                        {step.details}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
