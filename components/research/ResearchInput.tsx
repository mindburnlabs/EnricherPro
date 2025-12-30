
import React, { useState } from 'react';

interface ResearchInputProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
}

export const ResearchInput: React.FC<ResearchInputProps> = ({ onSearch, isLoading }) => {
    const [query, setQuery] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex items-center bg-gray-900 rounded-lg p-2 shadow-2xl ring-1 ring-gray-900/5">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask anything about cartridges (e.g., 'W1331X specs', 'HP 17A compatibility')..."
                        className="flex-1 bg-transparent text-white placeholder-gray-400 border-none outline-none px-4 py-3 text-lg"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className={`p-3 rounded-md transition-all ${isLoading
                                ? 'bg-gray-700 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            <div className="mt-4 flex gap-2 justify-center text-sm text-gray-500">
                <span className="px-2 py-1 bg-gray-800 rounded-full border border-gray-700 cursor-pointer hover:border-gray-500" onClick={() => setQuery("W1331X")}>W1331X</span>
                <span className="px-2 py-1 bg-gray-800 rounded-full border border-gray-700 cursor-pointer hover:border-gray-500" onClick={() => setQuery("HP CF259X weight")}>CF259X Specs</span>
                <span className="px-2 py-1 bg-gray-800 rounded-full border border-gray-700 cursor-pointer hover:border-gray-500" onClick={() => setQuery("Samsung MLT-D111S compatible printers")}>Samsung D111S</span>
            </div>
        </form>
    );
};
