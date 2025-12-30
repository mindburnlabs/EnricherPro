
import React from 'react';
import { EnrichedItem } from '../../types/domain';

interface ResultCardProps {
    item: EnrichedItem;
}

export const ResultCard: React.FC<ResultCardProps> = ({ item }) => {
    // Local state to handle optimistic updates/overrides
    const [data, setData] = React.useState(item.data);
    const [resolvingField, setResolvingField] = React.useState<string | null>(null);

    React.useEffect(() => {
        setData(item.data);
    }, [item]);

    // Helper to resolve conflict
    const resolveConflict = (conflictIndex: number, shouldUseValueB: boolean) => {
        if (!data.meta?.conflicts) return;

        const conflict = data.meta.conflicts[conflictIndex];
        const newData = { ...data };

        // Apply override
        if (conflict.field === 'weight_g' && newData.packaging) {
            newData.packaging = {
                ...newData.packaging,
                package_weight_g: shouldUseValueB ? conflict.valueB : conflict.valueA
            };
        }

        // Remove processed conflict
        const newConflicts = [...data.meta.conflicts];
        const resolvedConflict = { ...newConflicts[conflictIndex], resolution: 'resolved' as const };
        newConflicts.splice(conflictIndex, 1); // Remove from active list

        // Check if all resolved
        if (newConflicts.length === 0) {
            newData.automation_status = 'done';
        }

        newData.meta = {
            ...newData.meta!,
            conflicts: newConflicts
        };

        setData(newData);
        setResolvingField(null);
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-start bg-gradient-to-b from-gray-800/50 to-gray-900">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {data.brand} {data.model}
                    </h2>
                    <div className="flex gap-2 text-sm text-gray-400 items-center">
                        <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-300 border border-gray-700">{data.consumable_type}</span>
                        {data.yield?.value && (
                            <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-300 border border-gray-700">
                                {data.yield.value} pages
                            </span>
                        )}
                        {data.color && (
                            <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-300 border border-gray-700 capitalize">
                                {data.color}
                            </span>
                        )}
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${data.automation_status === 'done' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                        data.automation_status === 'needs_review' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' :
                            'bg-red-900/50 text-red-400 border border-red-800'
                    }`}>
                    {data.automation_status.replace('_', ' ')}
                </div>
            </div>

            {/* Conflict Alert */}
            {data.meta?.conflicts && data.meta.conflicts.length > 0 && (
                <div className="bg-orange-900/20 border-t border-b border-orange-900/50 p-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-2 text-orange-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-sm font-bold uppercase tracking-wider">Data Conflicts Detected</h3>
                    </div>
                    <div className="space-y-2">
                        {data.meta.conflicts.map((c, i) => (
                            <div key={i} className="flex flex-col gap-2 text-sm bg-orange-950/40 p-3 rounded border border-orange-900/30 transition-all">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-orange-300 uppercase text-xs font-bold">{c.field}</span>
                                    {resolvingField !== c.field && (
                                        <button
                                            onClick={() => setResolvingField(c.field)}
                                            className="text-xs bg-orange-700 hover:bg-orange-600 text-white px-3 py-1 rounded transition-colors"
                                        >
                                            Resolve
                                        </button>
                                    )}
                                </div>

                                {resolvingField === c.field && (
                                    <div className="grid grid-cols-2 gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                                        <button
                                            onClick={() => resolveConflict(i, false)}
                                            className="flex flex-col items-center p-3 rounded bg-gray-800 border border-gray-700 hover:border-green-500 hover:bg-green-900/20 transition-all group"
                                        >
                                            <span className="text-xs text-gray-500 uppercase font-bold mb-1">Option A</span>
                                            <span className="text-white font-mono text-lg">{String(c.valueA)}</span>
                                            <span className="text-[10px] text-gray-500 mt-1 truncate max-w-full">
                                                {c.sourceA}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => resolveConflict(i, true)}
                                            className="flex flex-col items-center p-3 rounded bg-gray-800 border border-gray-700 hover:border-green-500 hover:bg-green-900/20 transition-all group"
                                        >
                                            <span className="text-xs text-gray-500 uppercase font-bold mb-1">Option B</span>
                                            <span className="text-white font-mono text-lg">{String(c.valueB)}</span>
                                            <span className="text-[10px] text-gray-500 mt-1 truncate max-w-full">
                                                {c.sourceB}
                                            </span>
                                        </button>
                                    </div>
                                )}

                                {resolvingField !== c.field && (
                                    <div className="flex items-center gap-3 opacity-70">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white bg-gray-800 px-2 py-0.5 rounded border border-gray-700">{String(c.valueA)}</span>
                                            <span className="text-xs text-gray-500">vs</span>
                                            <span className="text-white bg-gray-800 px-2 py-0.5 rounded border border-gray-700">{String(c.valueB)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-800">
                {/* Logistics */}
                <div className="bg-gray-900 p-6">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Logistics (NIX.ru)</h3>
                    {data.packaging ? (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Weight</span>
                                <span className="text-white font-mono">{data.packaging.package_weight_g} g</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Dimensions</span>
                                <span className="text-white font-mono">
                                    {data.packaging.package_mm.length} x {data.packaging.package_mm.width} x {data.packaging.package_mm.height} mm
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-600 italic">No logistics data found.</p>
                    )}
                </div>

                {/* Compatibility */}
                <div className="bg-gray-900 p-6">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Compatibility</h3>
                    {data.compatibility_ru && data.compatibility_ru.printers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {data.compatibility_ru.printers.slice(0, 8).map(p => (
                                <span key={p} className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs border border-gray-700">
                                    {p}
                                </span>
                            ))}
                            {data.compatibility_ru.printers.length > 8 && (
                                <span className="px-2 py-1 text-gray-500 text-xs">+{data.compatibility_ru.printers.length - 8} more</span>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-600 italic">No compatibility data found.</p>
                    )}
                </div>
            </div>

            {/* Evidence Footer */}
            <div className="p-4 bg-gray-950 border-t border-gray-800 text-xs text-gray-500">
                <p className="mb-2 uppercase tracking-wider font-bold">Evidence Sources</p>
                <div className="flex flex-col gap-1">
                    {item.evidence.sources?.slice(0, 3).map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 truncate block">
                            {i + 1}. {s.url}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};
