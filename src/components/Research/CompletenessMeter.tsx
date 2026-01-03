import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConsumableData } from '../../types/domain.js';
import { AlertTriangle, CheckCircle, Circle } from 'lucide-react';

interface CompletenessMeterProps {
    data: ConsumableData;
    compact?: boolean;
}

export const CompletenessMeter: React.FC<CompletenessMeterProps> = ({ data, compact = false }) => {
    const { t } = useTranslation(['detail', 'common']);

    const analysis = useMemo(() => {
        const sections = {
            identity: {
                score: 0,
                total: 0,
                missing: [] as string[],
                fields: [
                    { key: 'brand', weight: 10, required: true },
                    { key: 'mpn_identity.mpn', weight: 10, required: true },
                    { key: 'images', weight: 5, required: true, check: (d: ConsumableData) => d.images && d.images.length > 0 },
                    { key: 'yield.value', weight: 5, required: false }
                ]
            },
            compatibility: {
                score: 0,
                total: 0,
                missing: [] as string[],
                fields: [
                    { key: 'compatible_printers_ru', weight: 20, required: true, check: (d: ConsumableData) => d.compatible_printers_ru && Array.isArray(d.compatible_printers_ru) && d.compatible_printers_ru.length > 0 }
                ]
            },
            logistics: {
                score: 0,
                total: 0,
                missing: [] as string[],
                fields: [
                    { key: 'logistics.package_weight_g', weight: 5, required: true },
                    { key: 'logistics.origin_country', weight: 5, required: false }
                ]
            },
            compliance: {
                score: 0,
                total: 0,
                missing: [] as string[],
                fields: [
                    { key: 'compliance_ru.tn_ved_code', weight: 5, required: true }
                ]
            }
        };

        // Placeholder for actual calculation logic that would populate sections, earnedWeight, and totalWeight
        // This part of the code is expected to be filled in by the user's broader changes
        let earnedWeight = 0;
        let totalWeight = 0;
        const allMissingFields: string[] = [];

        for (const sectionKey in sections) {
            const section = sections[sectionKey as keyof typeof sections];
            for (const field of section.fields) {
                totalWeight += field.weight;
                let isPresent = false;
                if ('check' in field && field.check) {
                    isPresent = field.check(data);
                } else {
                    // Basic check for nested properties
                    const keys = field.key.split('.');
                    let current: any = data;
                    for (const k of keys) {
                        if (current && typeof current === 'object' && k in current) {
                            current = current[k];
                        } else {
                            current = undefined;
                            break;
                        }
                    }
                    isPresent = current !== undefined && current !== null && current !== '';
                    if (Array.isArray(current) && current.length === 0) {
                        isPresent = false;
                    }
                }

                if (isPresent) {
                    earnedWeight += field.weight;
                    section.score += field.weight;
                } else if (field.required) {
                    section.missing.push(field.key);
                    allMissingFields.push(field.key);
                }
                section.total += field.weight;
            }
        }

        const globalScore = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;

        return { sections, globalScore, earnedWeight, totalWeight, missing: allMissingFields };
    }, [data]);

    const percentage = Math.round(analysis.globalScore);

    // Color logic
    const colorClass = percentage >= 80 ? 'text-emerald-500 bg-emerald-500' :
        percentage >= 50 ? 'text-amber-500 bg-amber-500' :
            'text-red-500 bg-red-500';

    const bgClass = percentage >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30' :
        percentage >= 50 ? 'bg-amber-100 dark:bg-amber-900/30' :
            'bg-red-100 dark:bg-red-900/30';

    if (compact) {
        return (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${percentage >= 80 ? 'border-emerald-200 dark:border-emerald-800' : 'border-amber-200 dark:border-amber-800'} ${bgClass}`}>
                <div className="relative w-4 h-4 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                            className="text-gray-200 dark:text-gray-700"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className={colorClass.split(' ')[0]}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeDasharray={`${percentage}, 100`}
                        />
                    </svg>
                </div>
                <span className={`text-xs font-bold ${percentage >= 80 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {percentage}%
                </span>
            </div>
        );
    }

    return (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('completeness.title', 'Data Completeness')}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bgClass} ${colorClass.split(' ')[0].replace('text-', 'text-')}`}>
                        {percentage}%
                    </span>
                </div>
                {percentage < 100 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {analysis.missing.length} {t('completeness.missing_count', 'fields missing')}
                    </span>
                )}
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                <div
                    className={`h-full transition-all duration-500 rounded-full ${colorClass.split(' ')[1]}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Missing Fields List */}
            {analysis.missing.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400 self-center mr-1">{t('completeness.missing', 'Missing')}:</span>
                    {analysis.missing.slice(0, 4).map((key) => (
                        <span key={key} className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] text-gray-500">
                            {t(key)}
                        </span>
                    ))}
                    {analysis.missing.length > 4 && (
                        <span className="text-[10px] text-gray-400 self-center">+{analysis.missing.length - 4} more</span>
                    )}
                </div>
            )}
            {analysis.missing.length === 0 && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    {t('completeness.perfect', 'All core fields populated')}
                </div>
            )}
        </div>
    );
};
