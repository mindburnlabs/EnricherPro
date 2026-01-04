import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QualityGatekeeper } from '../src/services/agents/QualityGatekeeper';
import { DeduplicationService } from '../src/services/backend/DeduplicationService';

// Mock DeduplicationService
vi.mock('../src/services/backend/DeduplicationService', () => ({
  DeduplicationService: {
    findPotentialDuplicate: vi.fn(),
  },
}));

describe('QualityGatekeeper Advanced Gates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const validBaseItem = {
    brand: 'HP',
    mpn_identity: { mpn: 'CF259X', canonical_model_name: 'HP 59X' },
    compatible_printers_ru: [{ model: 'HP LaserJet Pro M404' } as any],
    _evidence: {
      mpn_identity: { value: 'CF259X', source_url: 'https://hp.com' },
      compatible_printers_ru: { value: [], source_url: 'https://nix.ru' },
    },
  };

  it('Stage 3: Consistency - Should warn if dimensions exist but weight is missing', async () => {
    const item = {
      ...validBaseItem,
      packaging_from_nix: { width_mm: 100, height_mm: 100, depth_mm: 100, weight_g: null } as any,
    };

    const result = await QualityGatekeeper.validate(item as any);
    expect(result.warnings).toContain(
      'INCONSISTENT_LOGISTICS: Dimensions exist but weight is missing',
    );
    // Relaxed logic: consistency check stays TRUE, just adds warning
    expect(result.stages.consistency).toBe(true);
  });

  it('Stage 3: Consistency - Should pass if both exist', async () => {
    const item = {
      ...validBaseItem,
      packaging_from_nix: { width_mm: 100, height_mm: 100, depth_mm: 100, weight_g: 500 } as any,
    };

    const result = await QualityGatekeeper.validate(item as any);
    expect(result.stages.consistency).toBe(true);
  });

  it('Stage 6: Attribution - Should warn if critical fields lack evidence', async () => {
    const item = {
      ...validBaseItem,
      _evidence: {}, // Missing evidence
    };

    const result = await QualityGatekeeper.validate(item as any);
    expect(result.stages.attribution).toBe(false);
    expect(result.warnings).toContain('UNATTRIBUTED: Identity');
  });

  it('Stage 8: Deduplication - Should warn if duplicate found', async () => {
    // Mock duplicate found
    vi.mocked(DeduplicationService.findPotentialDuplicate).mockResolvedValue({
      id: 'existing-id',
      type: 'fuzzy',
    });

    const item = { ...validBaseItem };
    const result = await QualityGatekeeper.validate(item as any);

    expect(result.stages.deduplication).toBe(false);
    expect(result.warnings.some((w) => w.includes('POSSIBLE_DUPLICATE'))).toBe(true);
  });

  it('Complete Success - Should pass all gates with perfect data', async () => {
    vi.mocked(DeduplicationService.findPotentialDuplicate).mockResolvedValue(null);

    const item = {
      ...validBaseItem,
      packaging_from_nix: { width_mm: 100, weight_g: 500 } as any,
      _evidence: {
        mpn_identity: { source_url: 'https://hp.com' },
        compatible_printers_ru: { source_url: 'https://nix.ru' },
        something_else: { source_url: 'https://other.com' }, // 3rd source for completeness
      },
    };

    const result = await QualityGatekeeper.validate(item as any);

    expect(result.isValid).toBe(true);
    expect(result.stages.brand).toBe(true);
    expect(result.stages.identity).toBe(true);
    expect(result.stages.consistency).toBe(true);
    expect(result.stages.logistics).toBe(true);
    expect(result.stages.compatibility).toBe(true);
    expect(result.stages.attribution).toBe(true);
    expect(result.stages.completeness).toBe(true); // >= 2 domains
    expect(result.stages.deduplication).toBe(true);
  });
});
