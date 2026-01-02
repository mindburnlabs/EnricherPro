
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryAgent } from '../../src/services/agents/DiscoveryAgent';
import { BackendLLMService } from '../../src/services/backend/llm';
import { BackendFirecrawlService } from '../../src/services/backend/firecrawl';

// Mock dependencies
vi.mock('../../src/services/backend/llm');
vi.mock('../../src/services/backend/firecrawl');

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


});
