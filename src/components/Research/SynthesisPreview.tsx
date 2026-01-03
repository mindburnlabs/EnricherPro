/**
 * SynthesisPreview - Progressive rendering of synthesis data
 * 
 * Shows partial extraction results during LLM synthesis,
 * with animated placeholders for pending fields.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, Database, Package, FileText, Truck } from 'lucide-react';
import type { ConsumableData } from '../../types/domain.js';
import type { SynthesisProgress } from '../../hooks/useResearchStream.js';

interface SynthesisPreviewProps {
    progress: SynthesisProgress;
}

// Fields we care about showing progressively
const TRACKED_FIELDS = [
    { key: 'brand', icon: Database, label: 'Brand' },
    { key: 'mpn_identity', icon: FileText, label: 'MPN Identity' },
    { key: 'tech_specs', icon: Package, label: 'Tech Specs' },
    { key: 'logistics', icon: Truck, label: 'Logistics' },
    { key: 'compatible_printers_ru', icon: Check, label: 'Printers' },
] as const;

export function SynthesisPreview({ progress }: SynthesisPreviewProps) {
    const { t } = useTranslation(['common', 'detail']);
    const { partial, chunkIndex, totalChunks, isComplete } = progress;

    // Check which fields have data
    const fieldStatus = TRACKED_FIELDS.map(field => ({
        ...field,
        hasData: partial[field.key as keyof ConsumableData] !== undefined &&
            partial[field.key as keyof ConsumableData] !== null,
    }));

    const extractedCount = fieldStatus.filter(f => f.hasData).length;
    const progressPercent = Math.round((chunkIndex / Math.max(totalChunks, 1)) * 100);

    return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    </div>
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {t('common:synthesis.extracting', 'Extracting Data...')}
                    </span>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                    {progressPercent}%
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Field Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {fieldStatus.map(field => {
                    const Icon = field.icon;
                    return (
                        <div
                            key={field.key}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-300 ${field.hasData
                                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                }`}
                        >
                            {field.hasData ? (
                                <Check className="w-3 h-3" />
                            ) : (
                                <Icon className="w-3 h-3 opacity-50" />
                            )}
                            <span className={field.hasData ? 'font-medium' : 'opacity-75'}>
                                {field.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Quick Preview of Extracted Data */}
            {partial.brand && (
                <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">{t('detail:specs.brand', 'Brand')}:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{partial.brand}</span>
                        {partial.mpn_identity?.mpn && (
                            <>
                                <span className="text-gray-300 dark:text-gray-700">|</span>
                                <span className="font-mono text-blue-600 dark:text-blue-400">{partial.mpn_identity.mpn}</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
