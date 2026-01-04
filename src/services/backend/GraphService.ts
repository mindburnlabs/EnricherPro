import { db } from '../../db/index.js';
import { aliases, entities, edges } from '../../db/schema.js';
import { eq, and, ilike, desc } from 'drizzle-orm';

export class GraphService {
  /**
   * Resolves an input string (e.g. "12A", "HP 12A") to a Canonical Entity.
   * Returns the Canonical Name (MPN) and confidence.
   */
  static async resolveIdentity(
    query: string,
    brand?: string,
  ): Promise<{ mpn: string; confidence: number; entityId: string } | null> {
    if (!query) return null;
    const cleanQuery = query.trim();

    try {
      // 1. Direct Alias Match (Exact)
      const exactMatch = await db.query.aliases.findFirst({
        where: (t, { eq, and }) =>
          and(
            eq(t.alias, cleanQuery),
            // We could filter by aliasType='exact' but let's trust the table
          ),
        with: {
          entity: true,
        },
      });

      if (exactMatch && exactMatch.entity) {
        return {
          mpn: exactMatch.entity.canonicalName,
          confidence: exactMatch.confidence || 100,
          entityId: exactMatch.entityId,
        };
      }

      // 2. Case Insensitive Alias Match
      const caseMatch = await db.query.aliases.findFirst({
        where: (t, { eq }) => eq(t.alias, cleanQuery.toLowerCase()), // Assuming manual lower(), or use ilike
        with: {
          entity: true,
        },
      });

      if (caseMatch && caseMatch.entity) {
        return {
          mpn: caseMatch.entity.canonicalName,
          confidence: (caseMatch.confidence || 100) - 5,
          entityId: caseMatch.entityId,
        };
      }

      return null; // Graph Miss
    } catch (error: any) {
      // Gracefully handle missing Graph-Lite tables (not migrated yet)
      if (error?.cause?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.warn('[GraphService] Graph-Lite tables not migrated. Run: npx drizzle-kit push');
        return null;
      }
      throw error; // Re-throw unexpected errors
    }
  }

  /**
   * Checks if a Consumable Entity is compatible with a Printer Entity (by name/alias).
   */
  static async checkCompatibility(consumableMpn: string, printerModel: string): Promise<boolean> {
    // Resolve both entities first
    const consumable = await this.resolveIdentity(consumableMpn);
    const printer = await this.resolveIdentity(printerModel);

    if (!consumable || !printer) return false;

    // Check for edge
    const edge = await db.query.edges.findFirst({
      where: (t, { and, eq, or }) =>
        or(
          // Consumable -> Printer (COMPATIBLE_WITH)
          and(
            eq(t.fromEntityId, consumable.entityId),
            eq(t.toEntityId, printer.entityId),
            eq(t.type, 'COMPATIBLE_WITH'),
          ),
          // Printer -> Consumable (USES) - if we model it that way
          and(
            eq(t.fromEntityId, printer.entityId),
            eq(t.toEntityId, consumable.entityId),
            eq(t.type, 'COMPATIBLE_WITH'), // Assume bidirectional usage of same type for now, or just remove this block if strict
          ),
        ),
    });

    return !!edge;
  }

  /**
   * Legacy Adapter: Link Alias
   * Writes to the new 'aliases' and 'entities' tables.
   */
  static async linkAlias(
    alias: string,
    mpn: string,
    brand: string,
    source: string = 'inference',
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        // 1. Ensure Entity Exists
        let entityId: string;

        // Try to find entity by canonical name first
        const existingEntity = await tx.query.entities.findFirst({
          where: (t, { eq }) => eq(t.canonicalName, mpn),
        });

        if (existingEntity) {
          entityId = existingEntity.id;
        } else {
          const [newEntity] = await tx
            .insert(entities)
            .values({
              type: 'consumable', // Assumption for legacy adapter
              canonicalName: mpn,
              metadata: { brand },
            })
            .returning();
          entityId = newEntity.id;
        }

        // 2. Insert Alias
        await tx
          .insert(aliases)
          .values({
            entityId,
            alias: alias,
            aliasType: 'exact',
            confidence: source === 'inference' ? 90 : 100,
            locale: 'global',
          })
          .onConflictDoNothing();
      });
    } catch (e) {
      console.warn('GraphService: Failed to link alias', e);
    }
  }

  /**
   * Legacy Adapter: Link Compatibility
   */
  static async linkCompatibility(
    mpn: string,
    printer: string,
    source: string = 'inference',
  ): Promise<void> {
    // This is harder because we need to resolve/create the Printer entity too.
    // For MVP/Legacy, we might skip this or do a best-effort create.
    console.warn('GraphService: linkCompatibility not fully implemented for Graph-Lite yet.');
  }
}
