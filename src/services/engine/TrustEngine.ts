import { claims } from "../../db/schema.js";

type Claim = typeof claims.$inferSelect & { sourceDomain?: string; sourceType?: string };

interface ResolvedField<T> {
    value: T;
    confidence: number;
    sources: string[];
    isConflict: boolean;
    method: 'official' | 'consensus' | 'single_source' | 'fallback';
}

export class TrustEngine {

    // Domain Trust Tiers
    private static TRUST_TIERS: Record<string, number> = {
        'hp.com': 100, 'canon.com': 100, 'brother.com': 100, 'xerox.com': 100, // Official
        'nix.ru': 90, // Trusted Retailer (Spec-Heavy)
        'dns-shop.ru': 80, 'citilink.ru': 80, // Major Retailers
        'amazon.com': 70, // Marketplaces (high noise)
        'alibaba.com': 60,
    };

    /**
     * Resolves a single field from a list of claims using Trust & Quorum logic.
     */
    static resolveField<T>(fieldClaims: Claim[]): ResolvedField<T> | null {
        if (!fieldClaims || fieldClaims.length === 0) return null;

        // 1. Group by Normalized Value
        const grouped: Record<string, { count: number, domains: Set<string>, claims: Claim[], score: number }> = {};

        for (const claim of fieldClaims) {
            const val = claim.normalizedValue || claim.value;
            if (!grouped[val]) grouped[val] = { count: 0, domains: new Set(), claims: [], score: 0 };

            grouped[val].count++;
            if (claim.sourceDomain) grouped[val].domains.add(claim.sourceDomain);
            grouped[val].claims.push(claim);

            // Calculate Score based on Trust Tiers
            let trustStart = 50; // default
            if (claim.sourceDomain) {
                // partial match check
                for (const [domain, score] of Object.entries(this.TRUST_TIERS)) {
                    if (claim.sourceDomain.includes(domain)) {
                        trustStart = score;
                        break;
                    }
                }
            }
            grouped[val].score += trustStart;
        }

        // 2. Find Winner
        const sorted = Object.entries(grouped).sort((a, b) => b[1].score - a[1].score);
        const winner = sorted[0];
        const winnerVal = winner[0];
        const winnerStats = winner[1];

        // 3. Determine Confidence & Method
        let confidence = 0.5;
        let method: ResolvedField<T>['method'] = 'single_source';
        let isConflict = false;

        // Check for conflicts (if runner-up has significant score)
        if (sorted.length > 1) {
            const runnerUp = sorted[1];
            if (runnerUp[1].score > winnerStats.score * 0.5) {
                isConflict = true;
            }
        }

        // Boost logic
        const uniqueDomains = winnerStats.domains.size;

        // Official Source Rule
        const hasOfficial = winnerStats.claims.some(c => {
            const d = c.sourceDomain || '';
            return d.includes('hp.com') || d.includes('canon') || d.includes('epson');
        });

        // NIX Rule for Logistics
        const fieldName = fieldClaims[0].field; // assume all same field
        const isLogistics = fieldName.includes('weight') || fieldName.includes('dim');
        const hasNix = winnerStats.claims.some(c => (c.sourceDomain || '').includes('nix.ru'));

        if (hasOfficial) {
            confidence = 1.0;
            method = 'official';
            isConflict = false; // Official overrides conflict usually
        } else if (isLogistics && hasNix) {
            confidence = 0.95;
            method = 'official'; // Treat NIX as official for logistics
        } else if (uniqueDomains >= 3) {
            confidence = 0.9;
            method = 'consensus';
        } else if (uniqueDomains === 2) {
            confidence = 0.8;
            method = 'consensus';
        }

        if (isConflict && confidence < 0.9) {
            confidence = 0.4; // Penalize for conflict if no official source
        }

        // Cast value
        // Assuming string for now, but T allows flexibility.
        // We stored values as strings in DB.

        return {
            value: winnerVal as unknown as T, // Caller handles type parsing from string if needed
            confidence,
            sources: Array.from(winnerStats.domains),
            isConflict,
            method
        };
    }
}
