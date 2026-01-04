import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { EnrichedItem } from '../../types/domain.js';
import { getPublishingBlockers } from '../../lib/skuHelpers.js';

interface BlockersPanelProps {
    item: EnrichedItem;
    className?: string;
}

export const BlockersPanel: React.FC<BlockersPanelProps> = ({ item, className = '' }) => {
    const blockers = getPublishingBlockers(item);

    if (blockers.length === 0) return null;

    return (
        <div className={`bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-3 ${className}`}>
            <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle size={14} />
                Publishing Blockers
            </h4>
            <ul className="space-y-1">
                {blockers.map((b, i) => (
                    <li key={i} className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"/> {b}
                    </li>
                ))}
            </ul>
        </div>
    );
};
