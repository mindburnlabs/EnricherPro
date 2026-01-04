import { claims } from '../../db/schema.js';
import { WHITELIST_DOMAINS, OFFICIAL_DOMAINS } from '../../config/domains.js';

type Claim = typeof claims.$inferSelect & { sourceDomain?: string; sourceType?: string };

interface ResolvedField<T> {
  value: T;
  confidence: number;
  sources: string[];
  isConflict: boolean;
  method: 'official' | 'consensus' | 'single_source' | 'fallback' | 'agent_result';
}

export class TrustEngine {
  // Domain Trust Tiers
  private static TRUST_TIERS: Record<string, number> = {
    'nix.ru': 90, // Trusted Retailer (Spec-Heavy)
    'dns-shop.ru': 80,
    'citilink.ru': 80, // Major Retailers
    'amazon.com': 70, // Marketplaces (high noise)
    'alibaba.com': 60,
  };

  /**
   * Resolves a single field from a list of claims using Trust & Quorum logic.
   */
  static resolveField<T>(fieldClaims: Claim[]): ResolvedField<T> | null {
    if (!fieldClaims || fieldClaims.length === 0) return null;

    // 1. Group by Normalized Value
    const grouped: Record<
      string,
      { count: number; domains: Set<string>; claims: Claim[]; score: number }
    > = {};

    for (const claim of fieldClaims) {
      const val = claim.normalizedValue || claim.value;
      if (!grouped[val]) grouped[val] = { count: 0, domains: new Set(), claims: [], score: 0 };

      grouped[val].count++;
      if (claim.sourceDomain) grouped[val].domains.add(claim.sourceDomain);
      grouped[val].claims.push(claim);

      // Calculate Score based on Trust Tiers
      let trustStart = 50; // default
      const domain = claim.sourceDomain || '';
      const isAgent = claim.sourceType === 'firecrawl_agent' || claim.sourceType === 'agent_result';

      // Smart Scrutiny
      if (OFFICIAL_DOMAINS.some((d: string) => domain.includes(d))) {
        trustStart = 100; // Gold Standard
      } else if (WHITELIST_DOMAINS.some((d: string) => domain.includes(d))) {
        trustStart = 90; // Trusted Retailer
      } else if (isAgent) {
        trustStart = 75; // Agent on unknown domain (Good, but doesn't beat NIX)
      } else {
        // partial match check for others
        for (const [tDomain, score] of Object.entries(this.TRUST_TIERS)) {
          if (domain.includes(tDomain)) {
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

    // Check for conflicts
    if (sorted.length > 1) {
      const runnerUp = sorted[1];
      if (runnerUp[1].score > winnerStats.score * 0.7) {
        // Stricter conflict threshold
        isConflict = true;
      }
    }

    // Boost logic
    const uniqueDomains = winnerStats.domains.size;

    // Official Source Rule
    const hasOfficial = winnerStats.claims.some((c) => {
      const d = c.sourceDomain || '';
      return OFFICIAL_DOMAINS.some((od: string) => d.includes(od));
    });

    // Agent Rule (Verified)
    const hasAgent = winnerStats.claims.some(
      (c) => c.sourceType === 'firecrawl_agent' || c.sourceType === 'agent_result',
    );

    if (hasOfficial) {
      confidence = 1.0;
      method = 'official';
      isConflict = false;
    } else if (hasAgent && winnerStats.score >= 90) {
      // Only high trust agent
      confidence = 0.95;
      method = 'agent_result';
    } else if (uniqueDomains >= 3) {
      confidence = 0.9;
      method = 'consensus';
    } else if (uniqueDomains === 2) {
      confidence = 0.8;
      method = 'consensus';
    }

    // Downgrade low-trust agent
    if (method === 'agent_result' && winnerStats.score < 90) {
      confidence = 0.75; // Still decent, but not definitive
      if (isConflict) confidence = 0.5;
    }

    if (isConflict && confidence < 0.9) {
      confidence = 0.4;
    }

    return {
      value: winnerVal as unknown as T,
      confidence,
      sources: Array.from(winnerStats.domains),
      isConflict,
      method,
    };
  }
}
