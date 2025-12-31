
import React, { useState } from 'react';
import { EnrichedItem } from '../../types/domain.js';
import { Check, AlertTriangle, ExternalLink, Box, Tag, Layers } from 'lucide-react';
import { ItemDetail } from '../Research/ItemDetail.js';
import { useTranslation } from 'react-i18next';

interface ChatResultBlockProps {
    items: EnrichedItem[];
    onApprove: (id: string) => void;
    onMerge?: (item: EnrichedItem) => void;
    status: 'running' | 'completed' | 'failed';
}

export const ChatResultBlock: React.FC<ChatResultBlockProps> = ({ items, onApprove, onMerge, status }) => {
    const { t } = useTranslation('research');
    const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);

    if (!items || items.length === 0) return null;

    return (
        <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="flex items-center gap-2 pl-1 mb-2">
                <Box className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Research Findings
                </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {items.map(item => (
                    <div
                        key={item.id}
                        className="group relative rounded-2xl p-5 border border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-gray-800/20 backdrop-blur-xl hover:bg-white/60 dark:hover:bg-gray-800/40 hover:border-emerald-500/30 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                    >
                        {/* Background Gradient Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-emerald-50/0 dark:from-emerald-900/0 dark:to-emerald-900/0 group-hover:from-emerald-50/20 dark:group-hover:from-emerald-900/10 transition-colors duration-500" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    {/* Simple Icon Pill */}
                                    <div className="w-8 h-8 rounded-lg bg-gray-100/80 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 border border-gray-200/50 dark:border-gray-600/30">
                                        <Layers className="w-4 h-4" />
                                    </div>

                                    {/* Verification Badge (Mock logic based on score or source) */}
                                    {(item.data.confidence_score?.overall || 0) > 85 && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30" title="High Confidence">
                                            <Check className="w-3 h-3" />
                                            Verified
                                        </div>
                                    )}
                                </div>

                                <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm border ${(item.status as any) === 'needs_review'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                    }`}>
                                    {(item.status as any) === 'needs_review' && <AlertTriangle className="w-3 h-3" />}
                                    {(item.status as any).replace('_', ' ')}
                                </span>
                            </div>

                            <div className="mb-4">
                                <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100 leading-tight mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                    {item.data.mpn_identity.mpn || 'Unknown MPN'}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                    {item.data.mpn_identity.canonical_model_name}
                                </p>
                            </div>

                            {/* Specs / Metadata Grid */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="bg-gray-50/80 dark:bg-gray-900/40 rounded-lg p-2 border border-gray-100 dark:border-gray-800/50">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Brand</div>
                                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{item.data.brand || 'N/A'}</div>
                                </div>
                                <div className="bg-gray-50/80 dark:bg-gray-900/40 rounded-lg p-2 border border-gray-100 dark:border-gray-800/50">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Type</div>
                                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{item.data.consumable_type || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="mt-auto flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800/50">
                                <button
                                    onClick={() => setSelectedItem(item)}
                                    className="flex-1 px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Details
                                </button>

                                <button
                                    onClick={() => onApprove(item.id)}
                                    className="flex-1 px-3 py-2 text-xs font-bold text-white bg-gray-900 dark:bg-white dark:text-black rounded-xl hover:bg-emerald-600 dark:hover:bg-emerald-400 transition-all shadow-sm hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Approve
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ItemDetail
                item={selectedItem}
                open={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                // Fix: ItemDetail onApprove expects user to approve the conflicts or item
                onApprove={(id) => {
                    onApprove(id);
                    setSelectedItem(null);
                }}
            />
        </div>
    );
};
