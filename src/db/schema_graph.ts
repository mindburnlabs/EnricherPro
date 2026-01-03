import { pgTable, text, timestamp, uuid, integer, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { items } from './schema.js';

// --- GRAPH LITE: IDENTITY LAYER ---
// Maps various market aliases to a single Canonical MPN
export const skuAliases = pgTable('sku_aliases', {
    id: uuid('id').defaultRandom().primaryKey(),

    alias: text('alias').notNull(), // e.g. "12A", "Q2612", "Canon 703"
    canonicalMpn: text('canonical_mpn').notNull(), // e.g. "Q2612A"

    brand: text('brand'), // Optional constraint (e.g. "HP" 12A vs "Canon" 12A?? usually unique enough)

    source: text('source').default('inference'), // 'inference', 'manual', 'catalog_ingest'
    confidence: integer('confidence').default(100), // 1-100

    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    aliasIdx: uniqueIndex('alias_idx').on(table.alias, table.brand), // Ensure unique alias per brand
    mpnIdx: index('mpn_idx').on(table.canonicalMpn)
}));

// --- GRAPH LITE: COMPATIBILITY LAYER ---
// Directed Graph: Printer -> Consumable
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
// Tracks pages we monitor for continuous ingestion
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

// --- RELATIONS ---
// Note: We might want relations to 'items' if we want to link graph MPNs to rich Item records
// But Graph is often looser. Let's keep it loose for now to allow "Ghost Nodes" (known MPNs not yet fully enriched).
