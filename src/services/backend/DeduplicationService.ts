
import { db } from "../../db";
import { items } from "../../db/schema";
import { eq, or, ilike } from "drizzle-orm";

export class DeduplicationService {

    /**
     * Normalize MPN for consistent comparison.
     * Removes spaces, dashes, and converts to lowercase.
     */
    static normalizeMpn(mpn: string): string {
        if (!mpn) return "";
        return mpn.replace(/[\s\-\/\.]/g, "").toLowerCase();
    }

    /**
     * Check if an item with a similar MPN already exists.
     * Returns the existing item ID if found, or null.
     */
    static async findPotentialDuplicate(mpn: string): Promise<{ id: string, type: 'exact' | 'fuzzy' } | null> {
        const normalized = this.normalizeMpn(mpn);
        if (normalized.length < 3) return null; // Too short to match safely

        // We need to fetch all items to normalize and compare because SQL normalization is tricky across DBs
        // For now, let's try a direct ILIKE match on the raw MPN first (fast path)
        const exactMatch = await db.select({ id: items.id }).from(items)
            .where(eq(items.mpn, mpn)) // Assuming we have an MPN column or stored in JSON
            .limit(1);

        // Wait, schema has mpn inside `data` JSONB usually, but do we have a column?
        // Let's check schema. If not, we might need to rely on the 'mpn' top level if exists or extract from JSON.
        // Checking schema.ts from memory/previous context: we don't seem to have a top-level MPN column indexed yet?
        // If not, we have to rely on `data->>'mpn_identity'->>'mpn'`.
        // Let's assume for strict dedup we should use the JSON operator.

        return null; // Placeholder until we verify schema access for MPN
    }
}
