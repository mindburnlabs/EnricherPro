
import { enrichedClaims } from "../../db/schema.js";
import { InferSelectModel } from "drizzle-orm";

export type Claim = InferSelectModel<typeof enrichedClaims>;

export interface VerificationReport {
    skuId: string;
    fields: Record<string, FieldVerification>;
}

export interface FieldVerification {
    status: 'verified' | 'conflict' | 'pending';
    claims: Claim[];
    bestValue?: string;
    confidence: number;
    conflictInfo?: {
        conflictingValues: string[];
        severity: 'low' | 'medium' | 'high';
    };
}

export class Verifier {
    /**
     * Verifies a set of claims for a single SKU.
     */
    static verify(claims: Claim[]): VerificationReport {
        // Group by field
        const byField: Record<string, Claim[]> = {};
        for (const c of claims) {
            if (!byField[c.fieldName]) byField[c.fieldName] = [];
            byField[c.fieldName].push(c);
        }

        const report: VerificationReport = {
            skuId: claims[0]?.skuId || "unknown",
            fields: {}
        };

        for (const field of Object.keys(byField)) {
            report.fields[field] = this.verifyField(field, byField[field]);
        }

        return report;
    }

    private static verifyField(field: string, claims: Claim[]): FieldVerification {
        if (claims.length === 0) return { status: 'pending', claims: [], confidence: 0 };
        if (claims.length === 1) return { 
            status: 'verified', 
            claims, 
            bestValue: claims[0].fieldValue, 
            confidence: Number(claims[0].confidenceScore) || 0.5 
        };

        // Check for conflicts
        // Simple string equality for MVP. SOTA: Fuzzy matching / unit normalization happens before this.
        const values = new Set(claims.map(c => c.fieldValue));
        
        if (values.size === 1) {
             // All agree
             // Boost confidence if multiple sources agree
             const baseConf = Math.max(...claims.map(c => Number(c.confidenceScore) || 0));
             return {
                 status: 'verified',
                 claims,
                 bestValue: claims[0].fieldValue,
                 confidence: Math.min(0.99, baseConf + (claims.length * 0.1)) // Simple boost
             };
        } else {
            // Conflict
            return {
                status: 'conflict',
                claims,
                conflictInfo: {
                    conflictingValues: Array.from(values),
                    severity: 'high' // Default to high for safety
                },
                confidence: 0
            };
        }
    }
}
