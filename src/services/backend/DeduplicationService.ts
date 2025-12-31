
import { db } from '../../db/index.js';
import { items } from "../../db/schema.js";
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
        const normalizedInput = this.normalizeMpn(mpn);
        if (normalizedInput.length < 3) return null;

        // 1. Fast Path: Exact Match (DB)
        const exactMatches = await db.select({ id: items.id, data: items.data }).from(items);

        let bestMatch: { id: string, distance: number } | null = null;
        const FUZZY_THRESHOLD = 3;

        for (const item of exactMatches) {
            const itemMpn = (item.data as any)?.mpn_identity?.mpn || "";
            const itemNormalized = this.normalizeMpn(itemMpn);

            if (!itemNormalized) continue;

            if (itemNormalized === normalizedInput) {
                return { id: item.id, type: 'exact' };
            }

            const dist = this.levenshtein(normalizedInput, itemNormalized);
            if (dist < FUZZY_THRESHOLD) {
                if (!bestMatch || dist < bestMatch.distance) {
                    bestMatch = { id: item.id, distance: dist };
                }
            }
        }

        if (bestMatch) {
            return { id: bestMatch.id, type: 'fuzzy' };
        }

        return null;
    }

    private static levenshtein(a: string, b: string): number {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}
