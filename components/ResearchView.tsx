
import React from 'react';
import { ResearchInput } from './research/ResearchInput';
import { ProgressStream } from './research/ProgressStream';
import { ResultCard } from './research/ResultCard';
import { useAgentResearch } from '../hooks/useAgentResearch';

export const ResearchView: React.FC = () => {
    const { research, result, isLoading, steps, error } = useAgentResearch();

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center pt-24 px-4 font-sans">

            <div className="mb-12 text-center">
                <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-4">
                    Where knowledge begins
                </h1>
                <p className="text-gray-400 text-lg">
                    Agentic research for printer consumables.
                </p>
            </div>

            {/* Search Input */}
            <div className="w-full transition-all duration-500 ease-in-out transform">
                <ResearchInput onSearch={research} isLoading={isLoading} />
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-8 p-4 bg-red-900/30 border border-red-800 text-red-200 rounded-lg max-w-2xl text-center">
                    {error}
                </div>
            )}

            {/* Streaming Progress */}
            <div className="mt-8 w-full max-w-3xl">
                <ProgressStream steps={steps} />
            </div>

            {/* Result Card */}
            <div className="mt-8 w-full max-w-3xl pb-24">
                {result && <ResultCard item={result} />}
            </div>

        </div>
    );
};
