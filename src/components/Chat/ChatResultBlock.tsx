
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
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">
                Found Items
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {items.map(item => (
                    <div
                        key={item.id}
                        className="glass-card rounded-2xl p-5 flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden"
                    >
                        {/* Status Line */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${(item.status as any) === 'needs_review' ? 'bg-amber-400' : 'bg-emerald-500'}`} />

                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <Box className="w-5 h-5" />
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${(item.status as any) === 'needs_review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                                    {(item.status as any).replace('_', ' ')}
                                </span>
                            </div>

                            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100 leading-snug mb-1">
                                {item.data.mpn_identity.mpn || 'Unknown MPN'}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-4 line-clamp-2">
                                {item.data.mpn_identity.canonical_model_name}
                            </p>

                            {/* Key Specs Pills */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {item.data.brand && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-medium">
                                        <Tag className="w-3 h-3" /> {item.data.brand}
                                    </span>
                                )}
                                {item.data.consumable_type && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-medium">
                                        <Layers className="w-3 h-3" /> {item.data.consumable_type}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2 mt-auto">
                            <button
                                onClick={() => setSelectedItem(item)}
                                className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            >
                                Details
                            </button>

                            <button
                                onClick={() => onApprove(item.id)}
                                className="px-3 py-1.5 text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                            </button>
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
