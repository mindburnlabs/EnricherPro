
import React from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';

interface CitationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    evidence: any; // Using loose type for MVP, strictly Evidence[]
    fieldLabel: string;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ isOpen, onClose, evidence, fieldLabel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl h-full p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-semibold mb-2 pr-8">{fieldLabel}</h3>
                <p className="text-gray-500 text-sm mb-6">Verified from {evidence?.length || 0} sources</p>

                <div className="space-y-6">
                    {(evidence || []).map((ev: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                            {ev.confidence > 90 && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> VERIFIED
                                </div>
                            )}

                            <p className="text-gray-800 dark:text-gray-200 text-sm mb-3 leading-relaxed font-mono bg-white dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                                "{ev.rawSnippet || 'No snippet available'}"
                            </p>

                            <a
                                href={ev.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <ExternalLink className="w-3 h-3" />
                                {new URL(ev.sourceUrl).hostname}
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
