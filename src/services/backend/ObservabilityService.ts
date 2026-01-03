import { db } from '../../db/index.js';
import { modelUsage } from '../../db/schema_observability.js';
import { eq, sql, desc, and, gte, lte } from 'drizzle-orm';
import type { AgentUsageSummary, ModelUsageSummary, JobUsageSummary } from '../../db/schema_observability.js';

// OpenRouter Pricing (as of Jan 2026) - per 1M tokens
// These should be updated periodically or fetched from API
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
    'google/gemini-2.0-flash-exp:free': { prompt: 0, completion: 0 },
    'google/gemini-2.0-flash-001': { prompt: 0.1, completion: 0.4 },
    'google/gemini-exp-1206:free': { prompt: 0, completion: 0 },
    'deepseek/deepseek-r1:free': { prompt: 0, completion: 0 },
    'google/gemini-2.0-pro-exp-02-05:free': { prompt: 0, completion: 0 },
    'openrouter/auto': { prompt: 0.2, completion: 0.2 }, // Average estimate if actual model not returned
    'deepseek/deepseek-chat': { prompt: 0.14, completion: 0.28 },
    'anthropic/claude-3.5-sonnet': { prompt: 3, completion: 15 },
    'openai/gpt-4o': { prompt: 2.5, completion: 10 },
    'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
    'meta-llama/llama-3.3-70b-instruct': { prompt: 0.4, completion: 0.4 },
    // Fallback for unknown models
    'default': { prompt: 1, completion: 2 },
};

export interface UsageMetrics {
    model: string;
    provider?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs: number;
    statusCode?: number;
    isError?: string;
}

export interface TrackingContext {
    jobId?: string;
    tenantId?: string;
    agent: string;
    operation?: string;
}

/**
 * ObservabilityService - Tracks LLM usage for cost/latency analysis
 * 
 * Key Features:
 * - Per-request metrics recording
 * - Cost calculation based on model pricing
 * - Aggregation queries for dashboards
 */
export class ObservabilityService {

    /**
     * Track a single LLM API call
     */
    static async trackUsage(context: TrackingContext, metrics: UsageMetrics): Promise<void> {
        try {
            const costUsd = this.calculateCost(metrics.model, metrics.promptTokens, metrics.completionTokens);

            await db.insert(modelUsage).values({
                jobId: context.jobId || null,
                tenantId: context.tenantId || 'default',
                agent: context.agent,
                operation: context.operation,
                model: metrics.model,
                provider: metrics.provider || this.extractProvider(metrics.model),
                promptTokens: metrics.promptTokens,
                completionTokens: metrics.completionTokens,
                totalTokens: metrics.totalTokens || ((metrics.promptTokens || 0) + (metrics.completionTokens || 0)),
                latencyMs: metrics.latencyMs,
                costUsd: costUsd.toFixed(6),
                statusCode: metrics.statusCode,
                isError: metrics.isError,
            });
        } catch (error) {
            // Non-blocking: Log and continue
            console.warn('[ObservabilityService] Failed to record metrics:', error);
        }
    }

    /**
     * Calculate cost in USD based on model pricing
     */
    static calculateCost(model: string, promptTokens?: number, completionTokens?: number): number {
        const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
        const promptCost = ((promptTokens || 0) / 1_000_000) * pricing.prompt;
        const completionCost = ((completionTokens || 0) / 1_000_000) * pricing.completion;
        return promptCost + completionCost;
    }

    /**
     * Extract provider from model string (e.g., "openai/gpt-4o" -> "openai")
     */
    static extractProvider(model: string): string {
        return model.split('/')[0] || 'unknown';
    }

    // ======= AGGREGATION QUERIES =======

    /**
     * Get usage summary for a specific job
     */
    static async getJobSummary(jobId: string): Promise<JobUsageSummary | null> {
        const rows = await db.select({
            agent: modelUsage.agent,
            totalCalls: sql<number>`count(*)::int`,
            totalTokens: sql<number>`coalesce(sum(${modelUsage.totalTokens}), 0)::int`,
            totalCostUsd: sql<number>`coalesce(sum(${modelUsage.costUsd}::numeric), 0)::float`,
            avgLatencyMs: sql<number>`coalesce(avg(${modelUsage.latencyMs}), 0)::int`,
        })
            .from(modelUsage)
            .where(eq(modelUsage.jobId, jobId))
            .groupBy(modelUsage.agent);

        if (rows.length === 0) return null;

        const agentBreakdown: AgentUsageSummary[] = rows.map(r => ({
            agent: r.agent,
            totalCalls: r.totalCalls,
            totalTokens: r.totalTokens,
            totalCostUsd: r.totalCostUsd,
            avgLatencyMs: r.avgLatencyMs,
        }));

        return {
            jobId,
            totalCalls: agentBreakdown.reduce((sum, a) => sum + a.totalCalls, 0),
            totalTokens: agentBreakdown.reduce((sum, a) => sum + a.totalTokens, 0),
            totalCostUsd: agentBreakdown.reduce((sum, a) => sum + a.totalCostUsd, 0),
            totalLatencyMs: agentBreakdown.reduce((sum, a) => sum + a.avgLatencyMs * a.totalCalls, 0),
            agentBreakdown,
        };
    }

    /**
     * Get aggregated usage by agent (for dashboard pie charts)
     */
    static async getAgentSummaries(tenantId: string = 'default', days: number = 7): Promise<AgentUsageSummary[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const rows = await db.select({
            agent: modelUsage.agent,
            totalCalls: sql<number>`count(*)::int`,
            totalTokens: sql<number>`coalesce(sum(${modelUsage.totalTokens}), 0)::int`,
            totalCostUsd: sql<number>`coalesce(sum(${modelUsage.costUsd}::numeric), 0)::float`,
            avgLatencyMs: sql<number>`coalesce(avg(${modelUsage.latencyMs}), 0)::int`,
        })
            .from(modelUsage)
            .where(and(
                eq(modelUsage.tenantId, tenantId),
                gte(modelUsage.timestamp, since)
            ))
            .groupBy(modelUsage.agent);

        return rows;
    }

    /**
     * Get aggregated usage by model (for dashboard breakdown)
     */
    static async getModelSummaries(tenantId: string = 'default', days: number = 7): Promise<ModelUsageSummary[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const rows = await db.select({
            model: modelUsage.model,
            provider: modelUsage.provider,
            totalCalls: sql<number>`count(*)::int`,
            totalTokens: sql<number>`coalesce(sum(${modelUsage.totalTokens}), 0)::int`,
            totalCostUsd: sql<number>`coalesce(sum(${modelUsage.costUsd}::numeric), 0)::float`,
        })
            .from(modelUsage)
            .where(and(
                eq(modelUsage.tenantId, tenantId),
                gte(modelUsage.timestamp, since)
            ))
            .groupBy(modelUsage.model, modelUsage.provider);

        return rows.map(r => ({
            model: r.model,
            provider: r.provider || 'unknown',
            totalCalls: r.totalCalls,
            totalTokens: r.totalTokens,
            totalCostUsd: r.totalCostUsd,
        }));
    }

    /**
     * Get recent usage entries (for live dashboard)
     */
    static async getRecentUsage(limit: number = 50, tenantId: string = 'default') {
        return db.select()
            .from(modelUsage)
            .where(eq(modelUsage.tenantId, tenantId))
            .orderBy(desc(modelUsage.timestamp))
            .limit(limit);
    }

    /**
     * Get total spend for current period
     */
    static async getTotalSpend(tenantId: string = 'default', days: number = 30): Promise<{ totalCostUsd: number; totalCalls: number }> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [result] = await db.select({
            totalCostUsd: sql<number>`coalesce(sum(${modelUsage.costUsd}::numeric), 0)::float`,
            totalCalls: sql<number>`count(*)::int`,
        })
            .from(modelUsage)
            .where(and(
                eq(modelUsage.tenantId, tenantId),
                gte(modelUsage.timestamp, since)
            ));

        return {
            totalCostUsd: result?.totalCostUsd || 0,
            totalCalls: result?.totalCalls || 0,
        };
    }
}
