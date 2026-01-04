import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnrichedItem } from '../../types/domain.js';
import { AlertTriangle, ArrowRight, Check, Split, X } from 'lucide-react';

interface ConflictResolverModalProps {
    current: EnrichedItem;
    candidate: EnrichedItem;
    onResolve: (action: 'keep_current' | 'replace' | 'merge') => void;
    onCancel: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({ current, candidate, onResolve, onCancel }) => {
    const { t } = useTranslation(['common']);

    // Helper to calculate confidence diff
    const getConfidence = (item: EnrichedItem) => (item.data.confidence?.overall || 0) * 100;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-amber-50 dark:bg-amber-900/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Conflict Detected</h2>
                            <p className="text-sm text-amber-700 dark:text-amber-400">Please choose which version to keep.</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-black/5 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Comparison Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 gap-8">
                        
                        {/* Current (Left) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs">Current Version</h3>
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                    {getConfidence(current)}% Conf.
                                </span>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] text-gray-400">MPN</label>
                                        <div className="font-mono text-sm">{current.data.mpn_identity.mpn || "N/A"}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400">Title</label>
                                        <div className="text-sm line-clamp-2">{current.data.supplier_title_raw}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400">Specs</label>
                                        <div className="text-sm">
                                            Yield: {current.data.tech_specs.yield.value || "-"} {current.data.tech_specs.yield.unit || ""}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => onResolve('keep_current')}
                                className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Keep Current
                            </button>
                        </div>

                        {/* Candidate (Right) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-emerald-600 uppercase tracking-wider text-xs">New Candidate</h3>
                                <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400">
                                    {getConfidence(candidate)}% Conf.
                                </span>
                            </div>
                            <div className="border-2 border-emerald-500/20 rounded-xl p-4 bg-emerald-50/10 dark:bg-emerald-900/10">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] text-gray-400">MPN</label>
                                        <div className="font-mono text-sm">{candidate.data.mpn_identity.mpn || "N/A"}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400">Title</label>
                                        <div className="text-sm line-clamp-2">{candidate.data.supplier_title_raw}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400">Specs</label>
                                        <div className="text-sm">
                                            Yield: {candidate.data.tech_specs.yield.value || "-"} {candidate.data.tech_specs.yield.unit || ""}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => onResolve('replace')}
                                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Accept New Version
                            </button>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                    <button 
                        onClick={() => onResolve('merge')}
                        className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors"
                        title="Not implemented fully in MVP"
                    >
                        <Split className="w-4 h-4" />
                        Manual Merge (Advanced)
                    </button>
                </div>

            </div>
        </div>
    );
};
