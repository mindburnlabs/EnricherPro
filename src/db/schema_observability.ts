import { pgTable, text, timestamp, uuid, integer, numeric, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { jobs } from './schema.js';

// --- MODEL USAGE (Observability Layer) ---
// Tracks LLM API calls for cost/latency analysis per agent
export const modelUsage = pgTable('model_usage', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id').references(() => jobs.id),
    tenantId: text('tenant_id').default('default').notNull(),

    // Agent Context
    agent: text('agent').notNull(), // 'discovery', 'synthesis', 'enrichment', 'gatekeeper', 'logistics'
    operation: text('operation'), // 'plan', 'extract', 'merge', 'critique', etc.

    // Model Info
    model: text('model').notNull(),
    provider: text('provider'), // 'openrouter', 'google', 'openai'

    // Token Metrics
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),

    // Performance Metrics
    latencyMs: integer('latency_ms'),

    // Cost (in USD, 6 decimal precision for micro-cents)
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),

    // Request Metadata
    statusCode: integer('status_code'),
    isError: text('is_error'), // null = success, otherwise error type

    timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
    jobIdx: index('model_usage_job_idx').on(table.jobId),
    agentIdx: index('model_usage_agent_idx').on(table.agent),
    timestampIdx: index('model_usage_ts_idx').on(table.timestamp),
}));

// --- RELATIONS ---
export const modelUsageRelations = relations(modelUsage, ({ one }) => ({
    job: one(jobs, {
        fields: [modelUsage.jobId],
        references: [jobs.id],
    }),
}));

// --- AGGREGATION VIEWS (Virtual, computed in service) ---
// These types help structure the dashboard queries

export type AgentUsageSummary = {
    agent: string;
    totalCalls: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
};

export type ModelUsageSummary = {
    model: string;
    provider: string;
    totalCalls: number;
    totalTokens: number;
    totalCostUsd: number;
};

export type JobUsageSummary = {
    jobId: string;
    totalCalls: number;
    totalTokens: number;
    totalCostUsd: number;
    totalLatencyMs: number;
    agentBreakdown: AgentUsageSummary[];
};
