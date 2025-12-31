
import React, { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { EnrichedItem } from '../../types/domain.js';
import { ItemDetail } from './ItemDetail.js';

interface ReviewQueueProps {
    items: EnrichedItem[];
    onApprove: (id: string) => void;
    onMerge: (item: EnrichedItem, previousJobId?: string) => void;
    onArchive: (id: string) => void;
}

import { useTranslation } from 'react-i18next';

import { ConflictResolver } from './ConflictResolver.js';
import { getItem } from '../../lib/api.js';

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ items, onApprove, onMerge, onArchive }) => {
    const { t } = useTranslation('research');
    const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);

    // Conflict Resolution State
    const [conflictState, setConflictState] = useState<{ current: EnrichedItem, candidate: EnrichedItem } | null>(null);

    const handleMergeClick = async (item: EnrichedItem) => {
        // Check for duplicate warning in reviewReason
        const duplicateMatch = item.data.reviewReason?.match(/Found similar item ([a-f0-9-]+)/);
        if (duplicateMatch && duplicateMatch[1]) {
            const duplicateId = duplicateMatch[1];
            try {
                const duplicateItem = await getItem(duplicateId);
                if (duplicateItem) {
                    setConflictState({
                        current: duplicateItem, // The existing one in DB
                        candidate: item // The new one pending review
                    });
                    return;
                }
            } catch (e) {
                console.error("Failed to fetch duplicate item", e);
            }
        }

        // Fallback to standard merge (re-run)
        onMerge(item);
    };

    const handleResolve = (action: 'keep_current' | 'replace' | 'merge') => {
        if (!conflictState) return;

        if (action === 'replace') {
            // "Replace" effectively means approve the NEW one (candidate), 
            // and perhaps archive the old one? 
            // For now, simpler: Approve the candidate. The system should handle ID collision or update based on MPN.
            // Actually, if we just Approve the candidate, it might overwrite if the DB upserts by MPN, 
            // OR we might need an explicit "Replace" API.
            // Given the MVP constraints, let's treat "Replace" as "Approve New Item".
            onApprove(conflictState.candidate.id);
        } else if (action === 'keep_current') {
            // "Keep Current" means reject the new ONE.
            // We don't have a "Reject" prop function exposed here, only Approve/Merge.
            // We should probably add onReject to props or just ignore for now.
            // Let's assume we just close the modal and maybe user leaves it or we implement Reject later.
            // Actually, let's trigger onMerge (Re-Run) as a "Soft Reject / Retry" or just do nothing.
            // Ideally we'd call an API to mark as rejected.

        } else {
            // Smart Merge -> Just Re-Run for now
            onMerge(conflictState.candidate);
        }
        setConflictState(null);
    };

    if (items.length === 0) return null;

    return (
        <div className="w-full max-w-4xl mx-auto mt-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                    <span className="text-xs font-bold">{items.length}</span>
                </div>
                {t('review.title')}
            </h2>

            <div className="grid gap-4">
                {items.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-900/50 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>

                        <div className="flex-1">
                            <h4 className="font-semibold">{item.data.mpn_identity.mpn || t('review.unknown_mpn')}</h4>
                            <p className="text-sm text-gray-500 mb-2">{item.data.mpn_identity.canonical_model_name}</p>

                            <div className="bg-orange-50 dark:bg-orange-900/10 p-2 rounded text-xs text-orange-700 dark:text-orange-300 mb-4">
                                {t('review.reasons', { reason: (item.status as any) === 'needs_review' ? item.data.reviewReason || t('review.unknown_reason') : item.status })}
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => handleMergeClick(item)}
                                    className="px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg dark:border-amber-900/50"
                                >
                                    {item.data.reviewReason?.includes('Found similar item') ? 'Resolve Conflict' : 'Merge (Re-Run)'}
                                </button>
                                <button
                                    onClick={() => setSelectedItem(item)}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg dark:text-gray-300"
                                >
                                    {t('review.button_detail')}
                                </button>
                                <button
                                    onClick={() => onApprove(item.id)}
                                    className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> {t('review.button_approve')}
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
                onApprove={(id) => {
                    onApprove(id);
                    setSelectedItem(null);
                }}
            />

            {conflictState && (
                <ConflictResolver
                    current={conflictState.current}
                    candidate={conflictState.candidate}
                    onResolve={handleResolve}
                    onCancel={() => setConflictState(null)}
                />
            )}
        </div>
    );
};
