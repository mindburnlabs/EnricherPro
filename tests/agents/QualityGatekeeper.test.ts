
import { describe, it, expect } from 'vitest';
import { QualityGatekeeper } from '../../src/services/agents/QualityGatekeeper';

describe('QualityGatekeeper', () => {

    it('should validate perfect data', async () => {
        const perfectData = {
            mpn_identity: {
                brand: 'HP',
                mpn: 'CF217A',
                canonical_model_name: '17A',
                variant_flags: { chip: false, counterless: false, high_yield: false, kit: false }
            },
            logistics: { weight: { value: 1.0, unit: 'kg' } },
            compatible_printers_ru: ['M102'], // Strict requirement
            _evidence: { 'brand': { source_url: 'hp.com' }, 'compatible_printers_ru': { source_url: 'nix.ru' } }
        };

        const result = await QualityGatekeeper.validate(perfectData as any);

        expect(result.isValid).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('should catch missing MPN as fatal', async () => {
        const badData = {
            mpn_identity: { brand: 'HP', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false } }, // Missing MPN
        };

        const result = await QualityGatekeeper.validate(badData as any);

        expect(result.isValid).toBe(false);
        expect(result.score).toBe(0);
        expect(result.errors.some(e => e.includes('MPN'))).toBe(true);
    });

    it('should warn on missing logistics data', async () => {
        const partialData = {
            mpn_identity: { brand: 'HP', mpn: 'CF217A', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false } },
            logistics: {} // Empty
        };

        const result = await QualityGatekeeper.validate(partialData as any);

        // Still possibly valid but low score
        expect(result.stages.logistics).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});
