import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- JOBS (The "Deep Research" Session) ---
export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
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
    jobId: uuid('job_id').references(() => jobs.id).notNull(),

    // Identity
    mpn: text('mpn'),
    brand: text('brand'),
    model: text('model'),

    // The "Truth" (Consolidated Data)
    data: jsonb('data').notNull(), // Stores the full `StrictConsumableData` structure

    // Workflow State
    status: text('status', { enum: ['processing', 'needs_review', 'published', 'rejected'] }).default('processing').notNull(),
    reviewReason: text('review_reason'), // e.g. "Low Confidence", "Conflict"

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

// --- RELATIONS ---
export const jobsRelations = relations(jobs, ({ many }) => ({
    items: many(items),
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
