
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Search, Zap, Database, TrendingUp, AlertCircle } from 'lucide-react';

interface Stats {
    jobs: number;
    items: number;
    searches: number;
    llm_ops: number;
}

export const CostDashboard: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);

    // Estimated costs (hardcoded assumptions for now)
    const COST_PER_SEARCH = 0.01; // Firecrawl ~$0.01/search
    const COST_PER_LLM_OP = 0.005; // ~Input + Output avg

    useEffect(() => {
        if (isOpen) {
            fetchStats();
        }
    }, [isOpen]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const totalCost = stats ? (stats.searches * COST_PER_SEARCH) + (stats.llm_ops * COST_PER_LLM_OP) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-emerald-500" />
                        Usage & Cost Estimate
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                        </div>
                    ) : stats ? (
                        <div className="space-y-8">
                            {/* Hero Cost */}
                            <div className="text-center space-y-2">
                                <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">Estimated Total Spend</div>
                                <div className="text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                                    ${totalCost.toFixed(3)}
                                </div>
                                <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 inline-block px-3 py-1 rounded-full">
                                    Based on local activity log heuristics
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Web Searches</span>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.searches}</div>
                                    <div className="text-xs text-blue-600/80 mt-1">~${(stats.searches * COST_PER_SEARCH).toFixed(2)}</div>
                                </div>

                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">LLM Operations</span>
                                    </div>
                                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.llm_ops}</div>
                                    <div className="text-xs text-purple-600/80 mt-1">~${(stats.llm_ops * COST_PER_LLM_OP).toFixed(2)}</div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Items Enriched</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.items}</div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Jobs Run</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.jobs}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-red-500">Failed to load stats</div>
                    )}
                </div>
            </div>
        </div>
    );
};
