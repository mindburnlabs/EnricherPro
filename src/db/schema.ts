import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, index, vector } from 'drizzle-orm/pg-core';
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

// --- EVIDENCE (Legacy/Simple Table - keeping for backward compat if needed, but 'claims' is the new way) ---
// --- EVIDENCE (Legacy/Simple Table - keeping for backward compat if needed, but 'claims' is the new way) ---
// DELETED

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

// --- FRONTIER (The Exploration Queue) ---
export const frontier = pgTable('frontier', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id').references(() => jobs.id).notNull(),

    type: text('type', { enum: ['query', 'url', 'domain_crawl', 'firecrawl_agent', 'deep_crawl', 'crawl_status', 'domain_map'] }).notNull(),
    value: text('value').notNull(), // The query string or URL

    status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending').notNull(),
    depth: integer('depth').default(0).notNull(),
    priority: integer('priority').default(50).notNull(), // 1-100, higher is first

    meta: jsonb('meta'), // source_id, attempt_count, discovered_from_url

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- SOURCE DOCUMENTS (Raw Scraped/Crawled content) ---
// Stores the raw HTML/Markdown before extraction
export const sourceDocuments = pgTable('source_documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id').references(() => jobs.id).notNull(),

    url: text('url').notNull(),
    domain: text('domain').notNull(),
    contentHash: text('content_hash'), // For deduplication

    rawContent: text('raw_content'), // Markdown or HTML
    extractedMetadata: jsonb('extracted_metadata'), // SEO title, date, author

    status: text('status', { enum: ['success', 'failed', 'blocked'] }).notNull(),
    httpCode: integer('http_code'),

    crawledAt: timestamp('crawled_at').defaultNow().notNull(),
});

// --- CLAIMS (Atomic Facts from Sources) ---
// Formerly "evidence" but more granular.
// "Source X claims Field Y is Value Z"
export const claims = pgTable('claims', {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id').references(() => items.id).notNull(),
    sourceDocId: uuid('source_doc_id').references(() => sourceDocuments.id), // Link to raw source

    field: text('field').notNull(), // e.g., 'specs.weight', 'identity.mpn'
    value: text('value').notNull(),
    normalizedValue: text('normalized_value'), // e.g. "1.2 kg" -> "1200" (g)

    confidence: integer('confidence').default(0),
    isAccepted: boolean('is_accepted').default(false),

    extractedAt: timestamp('extracted_at').defaultNow().notNull(),
});

// --- VECTOR MEMORY (The "Oracle") ---
export const itemEmbeddings = pgTable('item_embeddings', {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }).notNull(),

    // Google text-embedding-004 is 768 dimensions
    vector: vector('vector', { dimensions: 768 }).notNull(),

    // The content that was embedded (usually a synthesis of the item)
    content: text('content').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    // HNSW Index for fast similarity search
    // Note: Requires 'vector' extension enabled in Postgres
    embeddingIndex: index('embedding_idx').using('hnsw', table.vector.op('vector_cosine_ops')),
}));

// --- RELATIONS ---
export const jobsRelations = relations(jobs, ({ many }) => ({
    items: many(items),
    events: many(jobEvents),
    frontier: many(frontier),
    sourceDocuments: many(sourceDocuments),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
    job: one(jobs, {
        fields: [items.jobId],
        references: [jobs.id],
    }),
    claims: many(claims),
    embeddings: many(itemEmbeddings),
}));

export const itemEmbeddingsRelations = relations(itemEmbeddings, ({ one }) => ({
    item: one(items, {
        fields: [itemEmbeddings.itemId],
        references: [items.id],
    }),
}));



export const frontierRelations = relations(frontier, ({ one }) => ({
    job: one(jobs, {
        fields: [frontier.jobId],
        references: [jobs.id],
    }),
}));

export const sourceDocumentsRelations = relations(sourceDocuments, ({ one, many }) => ({
    job: one(jobs, {
        fields: [sourceDocuments.jobId],
        references: [jobs.id],
    }),
    claims: many(claims),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
    item: one(items, {
        fields: [claims.itemId],
        references: [items.id],
    }),
    sourceDocument: one(sourceDocuments, {
        fields: [claims.sourceDocId],
        references: [sourceDocuments.id],
    }),
}));

export * from './schema_graph.js';
export * from './schema_graph_lite.js';
export * from './schema_observability.js';

