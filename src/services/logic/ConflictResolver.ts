import { FieldVerification } from './Verifier.js';
import { enrichedClaims } from '../../db/schema.js';
import { InferSelectModel } from 'drizzle-orm';

export type Claim = InferSelectModel<typeof enrichedClaims>;

export class ConflictResolver {
  /**
   * Attempts to automatically resolve a conflict.
   */
  static resolve(field: FieldVerification): {
    resolvedValue?: string;
    strategy: string;
    status: 'resolved' | 'open';
  } {
    if (field.status !== 'conflict') {
      return { resolvedValue: field.bestValue, strategy: 'single_consensus', status: 'resolved' };
    }

    // Strategy 1: Source Priority
    // Official (priority 1) > Marketplace (priority 2) > Generic (priority 3)
    // We need to fetch 'Source Type' which is in Evidence.
    // NOTE: Claim -> EvidenceId -> Evidence Record.
    // For SOTA speed, we might assume the claim has metadata or we fetch joins.
    // As a simplification for this file (pure logic), we assume 'confidenceScore' reflects the source priority already.

    const sorted = [...field.claims].sort((a, b) => {
      const scoreA = Number(a.confidenceScore) || 0;
      const scoreB = Number(b.confidenceScore) || 0;
      return scoreB - scoreA;
    });

    const winner = sorted[0];
    const runnerUp = sorted[1];

    // If clearly better (e.g. 90 vs 50)
    if ((Number(winner.confidenceScore) || 0) > (Number(runnerUp.confidenceScore) || 0) + 20) {
      return {
        resolvedValue: winner.fieldValue,
        strategy: 'high_confidence_winner',
        status: 'resolved',
      };
    }

    // Strategy 2: Majority Vote (if > 2 claims)
    if (field.claims.length >= 3) {
      const counts: Record<string, number> = {};
      for (const c of field.claims) {
        counts[c.fieldValue] = (counts[c.fieldValue] || 0) + 1;
      }
      const values = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      if (counts[values[0]] > counts[values[1]]) {
        return {
          resolvedValue: values[0],
          strategy: 'majority_vote',
          status: 'resolved',
        };
      }
    }

    // If no resolution
    return {
      strategy: 'manual_review_required',
      status: 'open',
    };
  }
}
