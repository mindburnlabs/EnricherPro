import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, index, vector, numeric, uniqueIndex, primaryKey, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
    skuId: uuid('sku_id').references(() => skus.id), // Link to new SKU table (spec requirement)
});

// --- MODEL USAGE (Observability Layer) ---
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
    embeddingIndex: index('embedding_idx').using('hnsw', table.vector.op('vector_cosine_ops')),
}));


// --- MERGED: GRAPH LITE Entities & Edges (from schema_graph_lite.ts) ---

// --- 1. ENTITY (The Nodes) ---
export const entities = pgTable('entities', {
    id: uuid('id').defaultRandom().primaryKey(),

    type: text('type', { enum: ['brand', 'printer', 'consumable', 'series', 'unknown'] }).notNull(),
    canonicalName: text('canonical_name').notNull(), // "HP LaserJet 1010"

    metadata: jsonb('metadata'), // { "release_year": 2005, "oem_mpn": "Q2612A" }

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 2. ALIAS (The Resolver Index) ---
export const aliases = pgTable('aliases', {
    id: uuid('id').defaultRandom().primaryKey(),
    entityId: uuid('entity_id').references(() => entities.id).notNull(),

    alias: text('alias').notNull(), // Normalized: "q2612a", "12a", "canon 303"
    aliasType: text('alias_type', { enum: ['exact', 'regex', 'weak_signal', 'machine_generated'] }).notNull(),
    locale: text('locale').default('global'), // 'ru', 'en'

    confidence: integer('confidence').default(100),

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    uniqueAlias: uniqueIndex('unique_alias_locale').on(table.alias, table.locale),
    aliasIdx: index('alias_lookup_idx').on(table.alias),
}));

// --- 3. EDGE (The Relationships) ---
export const edges = pgTable('edges', {
    id: uuid('id').defaultRandom().primaryKey(),

    fromEntityId: uuid('from_entity_id').references(() => entities.id).notNull(),
    toEntityId: uuid('to_entity_id').references(() => entities.id).notNull(),

    type: text('type', { enum: ['COMPATIBLE_WITH', 'MANUFACTURED_BY', 'ALSO_KNOWN_AS', 'REPLACED_BY', 'PART_OF_SERIES'] }).notNull(),

    metadata: jsonb('metadata'), // { "region": "EU" }

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    uniqueEdge: uniqueIndex('unique_graph_edge').on(table.fromEntityId, table.toEntityId, table.type),
    fromIdx: index('edge_from_idx').on(table.fromEntityId),
    toIdx: index('edge_to_idx').on(table.toEntityId),
}));

// --- 4. EVIDENCE (Provenance) ---
export const evidence = pgTable('graph_evidence', {
    id: uuid('id').defaultRandom().primaryKey(),

    edgeId: uuid('edge_id').references(() => edges.id),
    aliasId: uuid('alias_id').references(() => aliases.id),

    sourceUrl: text('source_url').notNull(),
    snippet: text('snippet'),

    fetchedAt: timestamp('fetched_at').defaultNow(),
    confidence: integer('confidence').default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});


// --- MERGED: Graph Legacy (from schema_graph.ts) ---

// --- GRAPH LITE: IDENTITY LAYER ---
export const skuAliases = pgTable('sku_aliases', {
    id: uuid('id').defaultRandom().primaryKey(),

    alias: text('alias').notNull(), // e.g. "12A", "Q2612", "Canon 703"
    canonicalMpn: text('canonical_mpn').notNull(), // e.g. "Q2612A"

    brand: text('brand'), // Optional constraint

    source: text('source').default('inference'), // 'inference', 'manual', 'catalog_ingest'
    confidence: integer('confidence').default(100), // 1-100

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    aliasIdx: uniqueIndex('alias_idx').on(table.alias, table.brand), // Ensure unique alias per brand
    mpnIdx: index('mpn_idx').on(table.canonicalMpn)
}));

// --- GRAPH LITE: COMPATIBILITY LAYER ---
export const compatibilityEdges = pgTable('compatibility_edges', {
    id: uuid('id').defaultRandom().primaryKey(),

    printerModel: text('printer_model').notNull(), // e.g. "HP LaserJet 1010"
    consumableMpn: text('consumable_mpn').notNull(), // e.g. "Q2612A"

    isVerified: boolean('is_verified').default(false), // True if confirmed by efficient graph traversal or trusted source
    source: text('source').notNull(), // 'oem_manual', 'retail_catalog', 'inference'

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    uniqueEdge: uniqueIndex('unique_edge').on(table.printerModel, table.consumableMpn),
    printerIdx: index('printer_idx').on(table.printerModel),
    consumableIdx: index('consumable_idx').on(table.consumableMpn)
}));

// --- INGESTION: TRUSTED CATALOGS ---
export const trustedCatalogPages = pgTable('trusted_catalog_pages', {
    id: uuid('id').defaultRandom().primaryKey(),

    url: text('url').unique().notNull(), // e.g. "https://www.nix.ru/price/lasers_hp.html"
    domain: text('domain').notNull(), // "nix.ru"

    lastScrapedAt: timestamp('last_scraped_at'),
    crawlFrequencyHours: integer('crawl_frequency_hours').default(24),

    status: text('status', { enum: ['active', 'paused', 'error'] }).default('active'),
    errorMsg: text('error_msg'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});


// --- RELATIONS (Unified) ---

export const jobsRelations = relations(jobs, ({ many }) => ({
    items: many(items),
    events: many(jobEvents),
    frontier: many(frontier),
    sourceDocuments: many(sourceDocuments),
    modelUsage: many(modelUsage),
}));

export const modelUsageRelations = relations(modelUsage, ({ one }) => ({
    job: one(jobs, {
        fields: [modelUsage.jobId],
        references: [jobs.id],
    }),
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

// Graph v2 Relations
export const entitiesRelations = relations(entities, ({ many }) => ({
    aliases: many(aliases),
    outgoingEdges: many(edges, { relationName: 'outgoing' }),
    incomingEdges: many(edges, { relationName: 'incoming' }),
}));

export const aliasesRelations = relations(aliases, ({ one, many }) => ({
    entity: one(entities, {
        fields: [aliases.entityId],
        references: [entities.id],
    }),
    evidence: many(evidence),
}));

export const edgesRelations = relations(edges, ({ one, many }) => ({
    fromEntity: one(entities, {
        fields: [edges.fromEntityId],
        references: [entities.id],
        relationName: 'outgoing',
    }),
    toEntity: one(entities, {
        fields: [edges.toEntityId],
        references: [entities.id],
        relationName: 'incoming',
    }),
    evidence: many(evidence),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
    edge: one(edges, {
        fields: [evidence.edgeId],
        references: [edges.id],
    }),
    alias: one(aliases, {
        fields: [evidence.aliasId],
        references: [aliases.id],
    }),
}));

// --- NEW SKU ENRICHMENT AGENT SCHEMA ---

// 1. Evidence
export const evidenceRecords = pgTable('evidence', {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceUrl: text('source_url').notNull(),
    sourceType: text('source_type', { enum: ['official_website', 'marketplace', 'datasheet_pdf', 'forum', 'manual', 'generic'] }).notNull(),
    contentSnippet: text('content_snippet').notNull(),
    contentHash: text('content_hash').notNull().unique(), // Unique constraint on hash
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    priorityScore: integer('priority_score').default(50).notNull(),
    metadata: jsonb('metadata'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    urlIdx: index('idx_evidence_url').on(table.sourceUrl),
    typePriorityIdx: index('idx_evidence_type_priority').on(table.sourceType, table.priorityScore),
}));

// 2. SKU
export const skus = pgTable('sku', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierString: text('supplier_string').notNull(),
    mpn: text('mpn'),
    brand: text('brand'),
    consumableType: text('consumable_type'), // 'toner', 'inkjet', 'drum', 'maintenance_kit'
    shortAlias: text('short_alias'),
    yieldPages: integer('yield_pages'),
    color: text('color'),
    chipPresence: boolean('chip_presence'),
    oemOrCompatible: text('oem_or_compatible'),

    // Package
    packageLengthMm: integer('package_length_mm'),
    packageWidthMm: integer('package_width_mm'),
    packageHeightMm: integer('package_height_mm'),
    packageWeightG: integer('package_weight_g'),

    // Media
    heroImageUrl: text('hero_image_url'),
    imageQcStatus: text('image_qc_status', { enum: ['pending', 'passed', 'failed'] }),
    imageQcFailures: jsonb('image_qc_failures'),

    // Publishing
    publishedChannels: jsonb('published_channels').default([]),
    blockedReasons: jsonb('blocked_reasons').default([]),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    mpnIdx: index('idx_sku_mpn').on(table.mpn),
    brandIdx: index('idx_sku_brand').on(table.brand),
}));

// 3. Claim
export const enrichedClaims = pgTable('claim', {
    id: uuid('id').defaultRandom().primaryKey(),
    skuId: uuid('sku_id').references(() => skus.id, { onDelete: 'cascade' }).notNull(),
    fieldName: text('field_name').notNull(),
    fieldValue: text('field_value').notNull(), // serialized
    status: text('status', { enum: ['pending', 'verified', 'conflict', 'locked'] }).notNull(),
    evidenceId: uuid('evidence_id').references(() => evidenceRecords.id),
    confidenceScore: numeric('confidence_score'), // float
    lockedAt: timestamp('locked_at'),
    lockedBy: text('locked_by'), // user_id

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    skuIdx: index('idx_claim_sku').on(table.skuId),
    statusIdx: index('idx_claim_status').on(table.status),
    // Composite unique constraint: sku_id + field_name + field_value
    uniqueClaim: uniqueIndex('claim_field_unique').on(table.skuId, table.fieldName, table.fieldValue),
    verifiedCheck: check('verified_requires_evidence', sql`status != 'verified' OR evidence_id IS NOT NULL`),
}));

// 4. Conflict
export const conflicts = pgTable('conflict', {
    id: uuid('id').defaultRandom().primaryKey(),
    skuId: uuid('sku_id').references(() => skus.id, { onDelete: 'cascade' }).notNull(),
    fieldName: text('field_name').notNull(),
    claimIds: uuid('claim_ids').array().notNull(),
    status: text('status', { enum: ['open', 'resolved', 'archived'] }).default('open').notNull(),
    resolutionStrategy: text('resolution_strategy'),
    resolvedClaimId: uuid('resolved_claim_id').references(() => enrichedClaims.id),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: text('resolved_by'),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    skuStatusIdx: index('idx_conflict_sku_status').on(table.skuId, table.status),
}));

// 5. PrinterModel
export const printerModels = pgTable('printer_model', {
    id: uuid('id').defaultRandom().primaryKey(),
    brand: text('brand').notNull(),
    modelName: text('model_name').notNull(),
    modelAliases: text('model_aliases').array(),
    ruConfirmed: boolean('ru_confirmed').default(false),
    metadata: jsonb('metadata'),
}, (table) => ({
    uniquePrinter: uniqueIndex('printer_model_unique').on(table.brand, table.modelName),
    brandModelIdx: index('idx_printer_brand_model').on(table.brand, table.modelName),
}));

// 6. SKU Printer Compatibility
export const skuPrinterCompatibility = pgTable('sku_printer_compatibility', {
    skuId: uuid('sku_id').references(() => skus.id, { onDelete: 'cascade' }).notNull(),
    printerId: uuid('printer_id').references(() => printerModels.id, { onDelete: 'cascade' }).notNull(),
    evidenceId: uuid('evidence_id').references(() => evidenceRecords.id),
    verified: boolean('verified').default(false),
}, (table) => ({
    pk: primaryKey({ columns: [table.skuId, table.printerId] }),
    printerIdx: index('idx_compat_printer').on(table.printerId),
}));

// 7. Similar Products
export const similarProducts = pgTable('similar_products', {
    skuId: uuid('sku_id').references(() => skus.id, { onDelete: 'cascade' }).notNull(),
    relatedSkuId: uuid('related_sku_id').references(() => skus.id, { onDelete: 'cascade' }).notNull(),
    relationshipType: text('relationship_type').notNull(), // 'used_in_same_printer', etc.
    strengthScore: numeric('strength_score').default('0.5'),

}, (table) => ({
    pk: primaryKey({ columns: [table.skuId, table.relatedSkuId] }),
    skuIdx: index('idx_similar_from').on(table.skuId),
}));

// 8. Audit Log
export const auditLogs = pgTable('audit_log', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    reason: text('reason'),
    evidenceIds: uuid('evidence_ids').array(),
    beforeValue: jsonb('before_value'),
    afterValue: jsonb('after_value'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
    userTsIdx: index('idx_audit_user_ts').on(table.userId, table.timestamp),
    entityIdx: index('idx_audit_entity').on(table.entityType, table.entityId),
}));

// --- RELATIONS FOR NEW TABLES ---

export const evidenceRecordsRelations = relations(evidenceRecords, ({ many }) => ({
    claims: many(enrichedClaims),
}));

export const skuRelations = relations(skus, ({ many }) => ({
    claims: many(enrichedClaims),
    conflicts: many(conflicts),
    printerCompatibility: many(skuPrinterCompatibility),
    similarProducts: many(similarProducts, { relationName: 'similar_from' }),
}));

export const enrichedClaimsRelations = relations(enrichedClaims, ({ one }) => ({
    sku: one(skus, {
        fields: [enrichedClaims.skuId],
        references: [skus.id],
    }),
    evidence: one(evidenceRecords, {
        fields: [enrichedClaims.evidenceId],
        references: [evidenceRecords.id],
    }),
}));

export const conflictsRelations = relations(conflicts, ({ one }) => ({
    sku: one(skus, {
        fields: [conflicts.skuId],
        references: [skus.id],
    }),
    resolvedClaim: one(enrichedClaims, {
        fields: [conflicts.resolvedClaimId],
        references: [enrichedClaims.id],
    }),
}));

export const printerModelsRelations = relations(printerModels, ({ many }) => ({
    compatibleSkus: many(skuPrinterCompatibility),
}));

export const skuPrinterCompatibilityRelations = relations(skuPrinterCompatibility, ({ one }) => ({
    sku: one(skus, {
        fields: [skuPrinterCompatibility.skuId],
        references: [skus.id],
    }),
    printer: one(printerModels, {
        fields: [skuPrinterCompatibility.printerId],
        references: [printerModels.id],
    }),
    evidence: one(evidenceRecords, {
        fields: [skuPrinterCompatibility.evidenceId],
        references: [evidenceRecords.id],
    }),
}));
