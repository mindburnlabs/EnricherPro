import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- JOBS (The "Deep Research" Session) ---
export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: text('tenant_id').default('default').notNull(), // Multi-tenancy
    userId: text('user_id'), // Optional, for auth
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending').notNull(),
    inputRaw: text('input_raw').notNull(),

    // Metrics
    progress: integer('progress').default(0), // 0-100
    startTime: timestamp('start_time').defaultNow(),
    endTime: timestamp('end_time'),

    meta: jsonb('meta'), // Any extra context
});

// --- ITEMS (The SKU / Consumable) ---
export const items = pgTable('items', {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: text('tenant_id').default('default').notNull(),
    jobId: uuid('job_id').references(() => jobs.id).notNull(),

    // Identity
    mpn: text('mpn'),
    brand: text('brand'),
    model: text('model'),

    // The "Truth" (Consolidated Data)
    data: jsonb('data').notNull(), // Stores the full `StrictConsumableData` structure

    // Workflow State
    status: text('status', { enum: ['processing', 'needs_review', 'published', 'rejected', 'failed'] }).default('processing').notNull(),
    reviewReason: text('review_reason'), // e.g. "Low Confidence", "Conflict"

    currentStep: text('current_step'), // 'planning', 'searching', 'enrichment', 'gate_check'

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {};
});

// --- EVIDENCE (The "Why") ---
// Granular evidence for specific fields. 
// "Field X in Item Y says Value Z because Source URL S said so."
export const evidence = pgTable('evidence', {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id').references(() => items.id).notNull(),

    fieldPath: text('field_path').notNull(), // e.g. "yield.value"
    rawSnippet: text('raw_snippet'),
    sourceUrl: text('source_url').notNull(),

    confidence: integer('confidence'), // 0-100
    isSelected: boolean('is_selected').default(false), // Is this the active truth?

    extractedAt: timestamp('extracted_at').defaultNow().notNull(),
});

// --- EVENTS (The "Live Stream") ---
export const jobEvents = pgTable('job_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: text('tenant_id').default('default').notNull(),
    jobId: uuid('job_id').references(() => jobs.id).notNull(),

    agent: text('agent').notNull(), // 'orchestrator', 'discovery', 'synthesis', 'logistics', 'gatekeeper'
    message: text('message').notNull(),
    type: text('type', { enum: ['info', 'warning', 'error', 'success'] }).default('info').notNull(),

    timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// --- RELATIONS ---
export const jobsRelations = relations(jobs, ({ many }) => ({
    items: many(items),
    events: many(jobEvents),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
    job: one(jobs, {
        fields: [items.jobId],
        references: [jobs.id],
    }),
    evidence: many(evidence),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
    item: one(items, {
        fields: [evidence.itemId],
        references: [items.id],
    }),
}));
