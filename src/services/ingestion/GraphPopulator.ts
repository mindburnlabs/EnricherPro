import { db } from '../../db/index.js';
import { entities, aliases, edges, evidence } from '../../db/schema.js';
import { claims } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import type { ConsumableData } from '../../types/domain.js';

/**
 * GraphPopulator - Automatically populates Graph-Lite from research results
 *
 * This service extracts entities, aliases, and edges from synthesized
 * ConsumableData and links them to the claims for provenance tracking.
 */
export class GraphPopulator {
  /**
   * Main entry point: Populate graph from a completed research item
   * @param itemId - The item ID in the `items` table
   * @param data - The synthesized ConsumableData
   * @param jobId - Job ID for logging
   */
  static async populateFromResearch(
    itemId: string,
    data: Partial<ConsumableData>,
    jobId: string,
  ): Promise<{
    entitiesCreated: number;
    edgesCreated: number;
  }> {

    // Starting population for item itemId

    let entitiesCreated = 0;
    let edgesCreated = 0;

    try {
      await db.transaction(async (tx) => {
        // 1. Extract and upsert the primary consumable entity
        const consumableEntity = await this.upsertConsumableEntity(tx, data, itemId);
        if (!consumableEntity.isExisting) entitiesCreated++;

        // 2. Extract and upsert brand entity
        if (data.brand) {
          const brandEntity = await this.upsertBrandEntity(tx, data.brand);
          if (!brandEntity.isExisting) entitiesCreated++;

          // Create MANUFACTURED_BY edge
          const edgeCreated = await this.upsertEdge(
            tx,
            consumableEntity.id,
            brandEntity.id,
            'MANUFACTURED_BY',
          );
          if (edgeCreated) edgesCreated++;
        }

        // 3. Extract and upsert compatible printers
        const compatiblePrinters = this.extractCompatiblePrinters(data);
        for (const printerName of compatiblePrinters) {
          const printerEntity = await this.upsertPrinterEntity(tx, printerName, data.brand);
          if (!printerEntity.isExisting) entitiesCreated++;

          // Create COMPATIBLE_WITH edge
          const edgeCreated = await this.upsertEdge(
            tx,
            consumableEntity.id,
            printerEntity.id,
            'COMPATIBLE_WITH',
          );
          if (edgeCreated) edgesCreated++;
        }

        // 4. Extract aliases (GTIN, cross_reference_mpns)
        const additionalAliases = this.extractAliases(data);
        for (const alias of additionalAliases) {
          await this.upsertAlias(tx, consumableEntity.id, alias.value, alias.type);
        }

        // 5. Link evidence from claims (provenance)
        await this.linkEvidenceFromClaims(tx, itemId, consumableEntity.id);
      });


      // Completed: entitiesCreated entities, edgesCreated edges created
    } catch (error) {
      console.error('[GraphPopulator] Error during population:', error);
      throw error;
    }

    return { entitiesCreated, edgesCreated };
  }

  // ======= ENTITY UPSERT HELPERS =======

  private static async upsertConsumableEntity(
    tx: any,
    data: Partial<ConsumableData>,
    itemId: string,
  ): Promise<{ id: string; isExisting: boolean }> {
    const mpn = data.mpn_identity?.mpn || (data as any).mpn || (data as any).model;
    if (!mpn) throw new Error('Cannot create consumable entity without MPN');

    const normalizedMpn = this.normalizeAlias(mpn);
    const canonicalName =
      data.marketing?.seo_title || (data as any).title || `${data.brand || ''} ${mpn}`.trim();

    // Check if alias already exists
    const [existing] = await tx
      .select()
      .from(aliases)
      .where(and(eq(aliases.alias, normalizedMpn), eq(aliases.aliasType, 'exact')))
      .limit(1);

    if (existing) {
      return { id: existing.entityId, isExisting: true };
    }

    // Create new entity
    const [newEntity] = await tx
      .insert(entities)
      .values({
        type: 'consumable',
        canonicalName,
        metadata: {
          brand: data.brand,
          mpn: mpn,
          itemId: itemId,
          consumable_type: data.type_classification?.family,
        },
      })
      .returning();

    // Create primary alias
    await tx
      .insert(aliases)
      .values({
        entityId: newEntity.id,
        alias: normalizedMpn,
        aliasType: 'exact',
        confidence: 100,
      })
      .onConflictDoNothing();

    return { id: newEntity.id, isExisting: false };
  }

  private static async upsertBrandEntity(
    tx: any,
    brandName: string,
  ): Promise<{ id: string; isExisting: boolean }> {
    const normalizedBrand = this.normalizeAlias(brandName);

    const [existing] = await tx
      .select()
      .from(aliases)
      .where(and(eq(aliases.alias, normalizedBrand), eq(aliases.aliasType, 'exact')))
      .limit(1);

    if (existing) {
      return { id: existing.entityId, isExisting: true };
    }

    const [newEntity] = await tx
      .insert(entities)
      .values({
        type: 'brand' as const,
        canonicalName: brandName,
        metadata: {},
      })
      .returning();

    await tx
      .insert(aliases)
      .values({
        entityId: newEntity.id,
        alias: normalizedBrand,
        aliasType: 'exact',
        confidence: 100,
      })
      .onConflictDoNothing();

    return { id: newEntity.id, isExisting: false };
  }

  private static async upsertPrinterEntity(
    tx: any,
    printerName: string,
    brand?: string,
  ): Promise<{ id: string; isExisting: boolean }> {
    const normalizedPrinter = this.normalizeAlias(printerName);

    const [existing] = await tx
      .select()
      .from(aliases)
      .where(and(eq(aliases.alias, normalizedPrinter), eq(aliases.aliasType, 'exact')))
      .limit(1);

    if (existing) {
      return { id: existing.entityId, isExisting: true };
    }

    const [newEntity] = await tx
      .insert(entities)
      .values({
        type: 'printer' as const,
        canonicalName: printerName,
        metadata: { brand },
      })
      .returning();

    await tx
      .insert(aliases)
      .values({
        entityId: newEntity.id,
        alias: normalizedPrinter,
        aliasType: 'exact',
        confidence: 90,
      })
      .onConflictDoNothing();

    return { id: newEntity.id, isExisting: false };
  }

  // ======= EDGE HELPERS =======

  private static async upsertEdge(
    tx: any,
    fromEntityId: string,
    toEntityId: string,
    type:
      | 'COMPATIBLE_WITH'
      | 'MANUFACTURED_BY'
      | 'ALSO_KNOWN_AS'
      | 'REPLACED_BY'
      | 'PART_OF_SERIES',
  ): Promise<boolean> {
    const [existing] = await tx
      .select({ id: edges.id })
      .from(edges)
      .where(
        and(
          eq(edges.fromEntityId, fromEntityId),
          eq(edges.toEntityId, toEntityId),
          eq(edges.type, type),
        ),
      )
      .limit(1);

    if (existing) return false;

    await tx
      .insert(edges)
      .values({
        fromEntityId,
        toEntityId,
        type,
        metadata: {},
      })
      .onConflictDoNothing();

    return true;
  }

  // ======= ALIAS HELPERS =======

  private static async upsertAlias(
    tx: any,
    entityId: string,
    aliasValue: string,
    aliasType: 'exact' | 'regex' | 'weak_signal' | 'machine_generated',
  ): Promise<void> {
    const normalized = this.normalizeAlias(aliasValue);
    if (!normalized) return;

    await tx
      .insert(aliases)
      .values({
        entityId,
        alias: normalized,
        aliasType,
        confidence: aliasType === 'exact' ? 100 : 80,
      })
      .onConflictDoNothing();
  }

  // ======= EVIDENCE LINKING =======

  private static async linkEvidenceFromClaims(
    tx: any,
    itemId: string,
    entityId: string,
  ): Promise<void> {
    // Get all claims for this item that have source docs
    const itemClaims = await tx
      .select({
        sourceUrl: sql<string>`sd.url`,
        confidence: claims.confidence,
      })
      .from(claims)
      .innerJoin(sql`source_documents sd`, sql`${claims.sourceDocId} = sd.id`)
      .where(eq(claims.itemId, itemId))
      .limit(10);

    // Link top sources as evidence for the entity (via aliases)
    // For now, we just log - full implementation would insert into graph_evidence
    // console.log(`[GraphPopulator] Found ${itemClaims.length} source claims to link`);
  }

  // ======= DATA EXTRACTION HELPERS =======

  private static extractCompatiblePrinters(data: Partial<ConsumableData>): string[] {
    const printers: string[] = [];

    // From compatible_printers_ru array
    if (data.compatible_printers_ru && Array.isArray(data.compatible_printers_ru)) {
      for (const p of data.compatible_printers_ru) {
        if (typeof p === 'string') {
          printers.push(p);
        } else if (p && typeof p === 'object' && 'model' in p) {
          printers.push((p as any).canonicalName || (p as any).model);
        }
      }
    }

    // Deduplicate
    return [...new Set(printers.map((p) => p.trim()).filter(Boolean))];
  }

  private static extractAliases(
    data: Partial<ConsumableData>,
  ): { value: string; type: 'exact' | 'weak_signal' }[] {
    const result: { value: string; type: 'exact' | 'weak_signal' }[] = [];

    // GTINs (barcodes)
    if (data.gtin && Array.isArray(data.gtin)) {
      for (const gtin of data.gtin) {
        if (gtin) result.push({ value: gtin, type: 'exact' });
      }
    }

    // Cross-reference MPNs
    if ((data as any).cross_reference_mpns && Array.isArray((data as any).cross_reference_mpns)) {
      for (const mpn of (data as any).cross_reference_mpns) {
        if (mpn) result.push({ value: mpn, type: 'exact' });
      }
    }

    // Aliases
    if ((data as any).aliases && Array.isArray((data as any).aliases)) {
      for (const alias of (data as any).aliases) {
        if (alias) result.push({ value: alias, type: 'weak_signal' });
      }
    }

    return result;
  }

  // ======= NORMALIZATION =======

  private static normalizeAlias(value: string): string {
    if (!value) return '';
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ''); // Remove non-alphanumeric
  }
}
