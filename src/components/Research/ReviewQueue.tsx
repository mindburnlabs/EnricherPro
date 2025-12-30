
import React, { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { EnrichedItem } from '../../types/domain';
import { ItemDetail } from './ItemDetail';

interface ReviewQueueProps {
    items: EnrichedItem[];
    onApprove: (id: string) => void;
}

import { useTranslation } from 'react-i18next';

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ items, onApprove }) => {
    const { t } = useTranslation('research');
    const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);

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
        </div>
    );
};
