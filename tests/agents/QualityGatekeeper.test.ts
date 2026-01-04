import { describe, it, expect, vi } from 'vitest';
import { QualityGatekeeper } from '../../src/services/agents/QualityGatekeeper.js';

vi.mock('../../src/services/backend/DeduplicationService.js', () => ({
  DeduplicationService: {
    findPotentialDuplicate: vi.fn().mockResolvedValue(null),
  },
}));

describe('QualityGatekeeper', () => {
  it('should validate perfect data', async () => {
    const perfectData = {
      brand: 'HP',
      mpn_identity: {
        mpn: 'CF217A',
        canonical_model_name: '17A',
        variant_flags: { chip: false, counterless: false, high_yield: false, kit: false },
      },
      logistics: { weight: { value: 1.0, unit: 'kg' } },
      packaging_from_nix: { weight_g: 1000 },
      compatible_printers_ru: ['M102'], // Strict requirement
      _evidence: {
        mpn_identity: { source_url: 'https://hp.com' },
        compatible_printers_ru: { source_url: 'https://nix.ru' },
      },
    };

    const result = await QualityGatekeeper.validate(perfectData as any);

    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80); // Adjusted threshold
  });

  it('should mark missing MPN as warning, not fatal error', async () => {
    const badData = {
      brand: 'HP',
      mpn_identity: {
        variant_flags: { chip: false, counterless: false, high_yield: false, kit: false },
      }, // Missing MPN
      _evidence: { brand: { source_url: 'https://hp.com' } }, // Single source
    };

    const result = await QualityGatekeeper.validate(badData as any);

    // With strict source check: 1 source is not enough for high quality but might pass "isValid" for review if identity is strong?
    // Actually uniqueDomains.size must be > 0. Here it is 1.
    // But Identity requires MPN length > 2. However, brand check is separate.
    // Identity stage is only true if MPN exists. So Identity is false.
    // Compatibility is false.
    // isValid = (false || false) && true => false.

    expect(result.isValid).toBe(false);
    expect(result.score).toBeLessThan(50);
    expect(result.warnings.some((e) => e.includes('MISSING_MPN'))).toBe(true);
    expect(result.errors.length).toBe(0); // No hard errors anymore
  });

  it('should warn on missing logistics data', async () => {
    const partialData = {
      brand: 'HP',
      mpn_identity: {
        mpn: 'CF217A',
        variant_flags: { chip: false, counterless: false, high_yield: false, kit: false },
      },
      logistics: {}, // Empty
      _evidence: { mpn_identity: { source_url: 'https://hp.com' } },
    };

    const result = await QualityGatekeeper.validate(partialData as any);

    // Still possibly valid but low score
    expect(result.stages.logistics).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
