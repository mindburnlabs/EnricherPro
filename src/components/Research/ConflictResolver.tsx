
import React, { useState } from 'react';
import { ArrowRight, Check, X, Shuffle, AlertTriangle } from 'lucide-react';
import { EnrichedItem } from '../../types/domain.js';

interface ConflictResolverProps {
    current: EnrichedItem;
    candidate: EnrichedItem;
    onResolve: (action: 'keep_current' | 'replace' | 'merge') => void;
    onCancel: () => void;
}

import { useTranslation } from 'react-i18next';

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ current, candidate, onResolve, onCancel }) => {
    const { t } = useTranslation('detail');
    const [selectedAction, setSelectedAction] = useState<'keep_current' | 'replace' | 'merge' | null>(null);

    // Simple diff detection (visual only for now)
    const getDiff = (key: string, val1: any, val2: any) => {
        const s1 = JSON.stringify(val1);
        const s2 = JSON.stringify(val2);
        return s1 !== s2;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b dark:border-gray-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                            {t('conflict.title', 'Resolve Data Conflict')}
                        </h2>
                        <p className="text-gray-500 mt-1">
                            {t('conflict.description', 'A duplicate or conflicting item was found. Choose how to resolve it.')}
                        </p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Comparison Grid */}
                <div className="flex-1 overflow-auto p-6 grid grid-cols-2 gap-8 relative">
                    {/* Center Arrow */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-900 p-2 rounded-full border shadow-sm">
                        <ArrowRight className="w-6 h-6 text-gray-400" />
                    </div>

                    {/* Column 1: Current (Existing Store) */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedAction === 'keep_current' ? 'border-emerald-500 bg-emerald-50/10' : 'border-gray-200 dark:border-gray-800'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">{t('conflict.incoming', 'Candidate Item (New)')}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('conflict.tag_incoming', 'Incoming')}</span>
                        </div>

                        <div className="space-y-4 font-mono text-sm">
                            <Field label={t('identity.mpn', 'MPN')} value={current.data.mpn_identity.mpn} diff={getDiff('mpn', current.data.mpn_identity.mpn, candidate.data.mpn_identity.mpn)} />
                            <Field label={t('identity.title', 'Title')} value={current.data.title_norm} diff={getDiff('title', current.data.title_norm, candidate.data.title_norm)} />
                            <Field label={t('identity.brand', 'Brand')} value={current.data.brand} diff={getDiff('brand', current.data.brand, candidate.data.brand)} />
                            <Field label={t('identity.model', 'Model')} value={current.data.model} diff={getDiff('model', current.data.model, candidate.data.model)} />

                            <div className="pt-4 border-t border-dashed">
                                <h4 className="font-bold text-gray-500 mb-2">Metadata</h4>
                                <div className="text-xs text-gray-400">
                                    ID: {current.id.substring(0, 8)}...<br />
                                    Conf: {current.data.confidence?.overall}%
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedAction('keep_current')}
                            className={`w-full mt-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${selectedAction === 'keep_current' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <Check className="w-4 h-4" /> {t('conflict.action_keep', 'Keep This')}
                        </button>
                    </div>

                    {/* Column 2: Candidate (Existing DB Item) */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedAction === 'replace' ? 'border-emerald-500 bg-emerald-50/10' : 'border-gray-200 dark:border-gray-800'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">{t('conflict.existing', 'Existing Record (In Database)')}</span>
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{t('conflict.tag_existing', 'Conflict Target')}</span>
                        </div>

                        <div className="space-y-4 font-mono text-sm">
                            <Field label={t('identity.mpn', 'MPN')} value={candidate.data.mpn_identity.mpn} diff={getDiff('mpn', current.data.mpn_identity.mpn, candidate.data.mpn_identity.mpn)} />
                            <Field label={t('identity.title', 'Title')} value={candidate.data.title_norm} diff={getDiff('title', current.data.title_norm, candidate.data.title_norm)} />
                            <Field label={t('identity.brand', 'Brand')} value={candidate.data.brand} diff={getDiff('brand', current.data.brand, candidate.data.brand)} />
                            <Field label={t('identity.model', 'Model')} value={candidate.data.model} diff={getDiff('model', current.data.model, candidate.data.model)} />

                            <div className="pt-4 border-t border-dashed">
                                <h4 className="font-bold text-gray-500 mb-2">Metadata</h4>
                                <div className="text-xs text-gray-400">
                                    ID: {candidate.id.substring(0, 8)}...<br />
                                    Status: {candidate.status}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedAction('replace')}
                            className={`w-full mt-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${selectedAction === 'replace' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <Shuffle className="w-4 h-4" /> {t('conflict.action_replace', 'Replace Existing')}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
                    >
                        {t('actions.cancel', 'Cancel')}
                    </button>
                    <button
                        disabled={!selectedAction}
                        onClick={() => selectedAction && onResolve(selectedAction)}
                        className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all ${selectedAction
                            ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105 transform'
                            : 'bg-gray-300 cursor-not-allowed'
                            }`}
                    >
                        {t('conflict.confirm', 'Confirm Resolution')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Field = ({ label, value, diff }: { label: string, value: any, diff: boolean }) => (
    <div className={`p-2 rounded ${diff ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        <div className={`break-words ${diff ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
            {value ? String(value) : <span className="italic text-gray-300">null</span>}
        </div>
    </div>
);
