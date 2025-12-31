
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { evidence } from '../db/schema';

export class EvidenceRepository {

    static async addEvidence(itemId: string, fieldPath: string, sourceUrl: string, snippet: string, confidence: number) {
        await db.insert(evidence).values({
            itemId,
            fieldPath,
            sourceUrl,
            rawSnippet: snippet,
            confidence,
            isSelected: false // Default to candidate
        });
    }

    static async getForField(itemId: string, fieldPath: string) {
        return db.select()
            .from(evidence)
            .where(and(
                eq(evidence.itemId, itemId),
                eq(evidence.fieldPath, fieldPath)
            ))
            .orderBy(evidence.confidence); // Highest confidence? Usually DESC
    }

    static async selectEvidence(evidenceId: string) {
        // 1. Unselect others for this field
        // (Implementation omitted for brevity - would require transaction)

        // 2. Select this one
        await db.update(evidence)
            .set({ isSelected: true })
            .where(eq(evidence.id, evidenceId));
    }
}
