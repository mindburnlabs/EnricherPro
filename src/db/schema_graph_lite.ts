import { pgTable, text, timestamp, uuid, integer, boolean, uniqueIndex, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// --- 1. ENTITY (The Nodes) ---
// Generic to verify identity before we attach data.
export const entities = pgTable('entities', {
    id: uuid('id').defaultRandom().primaryKey(),

    type: text('type', { enum: ['brand', 'printer', 'consumable', 'series', 'unknown'] }).notNull(),
    canonicalName: text('canonical_name').notNull(), // "HP LaserJet 1010"

    metadata: jsonb('metadata'), // { "release_year": 2005, "oem_mpn": "Q2612A" }

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 2. ALIAS (The Resolver Index) ---
// The "Front Door" for fast lookup.
export const aliases = pgTable('aliases', {
    id: uuid('id').defaultRandom().primaryKey(),
    entityId: uuid('entity_id').references(() => entities.id).notNull(),

    alias: text('alias').notNull(), // Normalized: "q2612a", "12a", "canon 303"
    aliasType: text('alias_type', { enum: ['exact', 'regex', 'weak_signal', 'machine_generated'] }).notNull(),
    locale: text('locale').default('global'), // 'ru', 'en'

    confidence: integer('confidence').default(100),

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    // Unique constraint: An alias string + locale should map to one entity (ideally)
    uniqueAlias: uniqueIndex('unique_alias_locale').on(table.alias, table.locale),
    // GIN index for trigram similarity is usually handled by raw SQL migration or separate statement,
    // Drizzle support for GIN is specific. We'll add a standard index for now and creating custom index in migration if needed.
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
    // We might also want evidence for Aliases (why is X an alias of Y?)
    aliasId: uuid('alias_id').references(() => aliases.id),

    sourceUrl: text('source_url').notNull(),
    snippet: text('snippet'),

    fetchedAt: timestamp('fetched_at').defaultNow(),
    confidence: integer('confidence').default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- RELATIONS ---

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
