import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Zap, Clock, DollarSign, RefreshCw, Cpu, AlertTriangle, X } from 'lucide-react';
import type { AgentUsageSummary, ModelUsageSummary } from '../types/observability_types.js';

// API Fetcher (we'll add the API endpoint later)
async function fetchObservabilityData(endpoint: string, params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`/api/observability/${endpoint}?${query}`);
    if (!response.ok) throw new Error('Failed to fetch observability data');
    return response.json();
}

interface ObservabilityDashboardProps {
    tenantId?: string;
    jobId?: string; // If provided, show job-specific breakdown
}

export function ObservabilityDashboard({ tenantId = 'default', jobId }: ObservabilityDashboardProps) {
    const { t } = useTranslation(['common', 'settings']);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalSpend, setTotalSpend] = useState({ totalCostUsd: 0, totalCalls: 0 });
    const [agentSummaries, setAgentSummaries] = useState<AgentUsageSummary[]>([]);
    const [modelSummaries, setModelSummaries] = useState<ModelUsageSummary[]>([]);
    const [timeRange, setTimeRange] = useState<7 | 30 | 90>(7);

    // Cost Alert Thresholds
    const COST_THRESHOLDS = {
        warning: 5.00,  // $5.00 - yellow warning
        critical: 20.00, // $20.00 - red critical
        daily: 2.00,    // $2.00/day average
    };

    const [showAlert, setShowAlert] = useState(false);
    const [alertLevel, setAlertLevel] = useState<'warning' | 'critical' | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [spend, agents, models] = await Promise.all([
                fetchObservabilityData('total-spend', { tenantId, days: String(timeRange) }),
                fetchObservabilityData('agent-summaries', { tenantId, days: String(timeRange) }),
                fetchObservabilityData('model-summaries', { tenantId, days: String(timeRange) }),
            ]);
            setTotalSpend(spend);
            setAgentSummaries(agents);
            setModelSummaries(models);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [tenantId, timeRange]);

    // Cost Alert Checking
    useEffect(() => {
        if (totalSpend.totalCostUsd >= COST_THRESHOLDS.critical) {
            setAlertLevel('critical');
            setShowAlert(true);
        } else if (totalSpend.totalCostUsd >= COST_THRESHOLDS.warning) {
            setAlertLevel('warning');
            setShowAlert(true);
        } else {
            setAlertLevel(null);
            setShowAlert(false);
        }
    }, [totalSpend.totalCostUsd]);

    // Color palette for agents
    const agentColors: Record<string, string> = {
        discovery: 'hsl(var(--chart-1))',
        synthesis: 'hsl(var(--chart-2))',
        enrichment: 'hsl(var(--chart-3))',
        logistics: 'hsl(var(--chart-4))',
        gatekeeper: 'hsl(var(--chart-5))',
        orchestrator: 'hsl(var(--muted-foreground))',
    };

    const formatCost = (cost: number) => {
        if (cost < 0.01) return `$${cost.toFixed(4)}`;
        if (cost < 1) return `$${cost.toFixed(3)}`;
        return `$${cost.toFixed(2)}`;
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
        return String(tokens);
    };

    if (error) {
        return (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {t('common:error')}: {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">{t('settings:observability.title', 'Model Observability')}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {/* Time Range Selector */}
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(Number(e.target.value) as 7 | 30 | 90)}
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                    >
                        <option value={7}>{t('settings:observability.last7days', 'Last 7 days')}</option>
                        <option value={30}>{t('settings:observability.last30days', 'Last 30 days')}</option>
                        <option value={90}>{t('settings:observability.last90days', 'Last 90 days')}</option>
                    </select>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="rounded-md p-1.5 hover:bg-muted disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Cost Alert Banner */}
            {showAlert && alertLevel && (
                <div className={`rounded-lg border p-4 flex items-start gap-3 ${alertLevel === 'critical'
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                    }`}>
                    <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${alertLevel === 'critical' ? 'text-red-600' : 'text-amber-600'
                        }`} />
                    <div className="flex-1">
                        <h4 className={`font-medium ${alertLevel === 'critical' ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100'
                            }`}>
                            {alertLevel === 'critical'
                                ? t('settings:observability.criticalAlert', 'Critical: High Spending Detected!')
                                : t('settings:observability.warningAlert', 'Warning: Spending Threshold Exceeded')
                            }
                        </h4>
                        <p className={`text-sm mt-1 ${alertLevel === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
                            }`}>
                            {t('settings:observability.alertMessage', 'Your spending of {{amount}} exceeds the {{level}} threshold of {{threshold}}.', {
                                amount: formatCost(totalSpend.totalCostUsd),
                                level: alertLevel,
                                threshold: formatCost(alertLevel === 'critical' ? COST_THRESHOLDS.critical : COST_THRESHOLDS.warning)
                            })}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAlert(false)}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-xs font-medium">{t('settings:observability.totalSpend', 'Total Spend')}</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-primary">
                        {loading ? '...' : formatCost(totalSpend.totalCostUsd)}
                    </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Zap className="h-4 w-4" />
                        <span className="text-xs font-medium">{t('settings:observability.apiCalls', 'API Calls')}</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold">
                        {loading ? '...' : totalSpend.totalCalls.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Cpu className="h-4 w-4" />
                        <span className="text-xs font-medium">{t('settings:observability.totalTokens', 'Total Tokens')}</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold">
                        {loading ? '...' : formatTokens(agentSummaries.reduce((sum, a) => sum + a.totalTokens, 0))}
                    </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-medium">{t('settings:observability.avgLatency', 'Avg Latency')}</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold">
                        {loading ? '...' : `${Math.round(agentSummaries.reduce((sum, a) => sum + a.avgLatencyMs, 0) / Math.max(agentSummaries.length, 1))}ms`}
                    </p>
                </div>
            </div>

            {/* Agent Breakdown */}
            <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                    {t('settings:observability.byAgent', 'Usage by Agent')}
                </h3>
                {loading ? (
                    <div className="h-32 animate-pulse rounded-md bg-muted" />
                ) : agentSummaries.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                        {t('settings:observability.noData', 'No usage data yet')}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {agentSummaries.map((agent) => {
                            const maxCost = Math.max(...agentSummaries.map(a => a.totalCostUsd));
                            const percentage = maxCost > 0 ? (agent.totalCostUsd / maxCost) * 100 : 0;
                            return (
                                <div key={agent.agent} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 capitalize">
                                            <span
                                                className="h-3 w-3 rounded-full"
                                                style={{ backgroundColor: agentColors[agent.agent] || 'hsl(var(--muted))' }}
                                            />
                                            {agent.agent}
                                        </span>
                                        <span className="tabular-nums text-muted-foreground">
                                            {formatCost(agent.totalCostUsd)} · {formatTokens(agent.totalTokens)} tokens · {agent.avgLatencyMs}ms
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: agentColors[agent.agent] || 'hsl(var(--muted))',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Model Breakdown */}
            <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                    {t('settings:observability.byModel', 'Usage by Model')}
                </h3>
                {loading ? (
                    <div className="h-32 animate-pulse rounded-md bg-muted" />
                ) : modelSummaries.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                        {t('settings:observability.noData', 'No usage data yet')}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">{t('settings:observability.model', 'Model')}</th>
                                    <th className="pb-2 font-medium text-right">{t('settings:observability.calls', 'Calls')}</th>
                                    <th className="pb-2 font-medium text-right">{t('settings:observability.tokens', 'Tokens')}</th>
                                    <th className="pb-2 font-medium text-right">{t('settings:observability.cost', 'Cost')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {modelSummaries.sort((a, b) => b.totalCostUsd - a.totalCostUsd).map((model) => (
                                    <tr key={model.model} className="border-b last:border-0">
                                        <td className="py-2">
                                            <span className="font-mono text-xs">{model.model}</span>
                                        </td>
                                        <td className="py-2 text-right tabular-nums">{model.totalCalls}</td>
                                        <td className="py-2 text-right tabular-nums">{formatTokens(model.totalTokens)}</td>
                                        <td className="py-2 text-right tabular-nums font-medium">{formatCost(model.totalCostUsd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
