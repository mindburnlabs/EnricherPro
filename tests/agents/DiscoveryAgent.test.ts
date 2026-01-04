
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryAgent } from '../../src/services/agents/DiscoveryAgent';
import { BackendLLMService } from '../../src/services/backend/llm';
import { BackendFirecrawlService } from '../../src/services/backend/firecrawl';

// Mock dependencies
vi.mock('../../src/services/backend/llm');
vi.mock('../../src/services/backend/firecrawl');
vi.mock('../../src/services/backend/GraphService', () => ({
    GraphService: {
        resolveIdentity: vi.fn().mockResolvedValue(null)
    }
}));

describe('DiscoveryAgent', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('plan', () => {
        it('should return a plan from LLM', async () => {
            const mockPlan = {
                type: 'single_sku',
                mpn: 'CF217A',
                canonical_name: 'HP 17A',
                strategies: [{ name: 'Test', queries: ['q1'] }],
                suggestedBudget: {
                    concurrency: 3,
                    depth: 1,
                    mode: "balanced",
                }
            };

            // Mock LLM response
            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockPlan));

            const plan = await DiscoveryAgent.plan('HP 17A');

            expect(plan).toEqual(expect.objectContaining(mockPlan));
            expect(BackendLLMService.complete).toHaveBeenCalled();
        });

        it('should fail gracefully and return fallback', async () => {
            (BackendLLMService.complete as any).mockRejectedValue(new Error("API Error"));

            const plan = await DiscoveryAgent.plan('HP 17A');

            expect(plan.type).toBe('single_sku');
            expect(plan.canonical_name).toBe('HP 17A');
            expect(plan.strategies[0].name).toBe('Fallback Search');
        });
    });

    describe('critique (SOTA 2026 Tiered Severity)', () => {
        it('should return gaps with tiered severity levels', async () => {
            const mockCritiqueResponse = [
                { severity: "TIER1", goal: "Find missing MPN", value: "HP 17A + MPN" },
                { severity: "TIER2", goal: "Find compatible printers", value: "HP 17A + printers" },
                { severity: "TIER3", goal: "Find package weight", value: "HP 17A + weight" }
            ];

            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockCritiqueResponse));

            const gaps = await DiscoveryAgent.critique({ brand: 'HP' }, 'en');

            expect(Array.isArray(gaps)).toBe(true);
            expect(gaps.length).toBe(3);
            // Verify severity is included
            expect(gaps[0].severity).toBe('TIER1');
            expect(gaps[1].severity).toBe('TIER2');
            expect(gaps[2].severity).toBe('TIER3');
        });

        it('should sort results by severity (TIER1 first)', async () => {
            // Return out of order to test sorting
            const mockCritiqueResponse = [
                { severity: "TIER3", goal: "Find weight", value: "weight query" },
                { severity: "TIER1", goal: "Find MPN", value: "MPN query" },
                { severity: "TIER2", goal: "Find images", value: "image query" }
            ];

            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockCritiqueResponse));

            const gaps = await DiscoveryAgent.critique({ brand: 'HP' }, 'en');

            // Should be sorted: TIER1, TIER2, TIER3
            expect(gaps[0].severity).toBe('TIER1');
            expect(gaps[0].goal).toBe('Find MPN');
            expect(gaps[1].severity).toBe('TIER2');
            expect(gaps[2].severity).toBe('TIER3');
        });

        it('should return empty array when no gaps', async () => {
            (BackendLLMService.complete as any).mockResolvedValue('[]');

            const gaps = await DiscoveryAgent.critique({
                brand: 'HP',
                mpn_identity: { mpn: 'CF217A' },
                tech_specs: { yield: { value: 1600 } },
                images: ['http://example.com/img.jpg'],
                compatible_printers: ['LaserJet Pro M102']
            }, 'en');

            expect(Array.isArray(gaps)).toBe(true);
            expect(gaps.length).toBe(0);
        });
    });


});
