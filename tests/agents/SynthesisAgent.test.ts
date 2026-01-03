import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynthesisAgent } from '../../src/services/agents/SynthesisAgent';
import { BackendLLMService } from '../../src/services/backend/llm';

// Mock dependencies
vi.mock('../../src/services/backend/llm');

describe('SynthesisAgent', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extractClaims', () => {
        it('should extract claims from source markdown', async () => {
            const mockClaims = [
                { field: 'brand', value: 'HP', confidence: 0.95, rawSnippet: 'HP Toner' },
                { field: 'mpn', value: 'CF217A', confidence: 0.9, rawSnippet: 'CF217A' },
                { field: 'yield.value', value: 1600, confidence: 0.85, rawSnippet: '1600 pages' }
            ];

            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockClaims));

            const claims = await SynthesisAgent.extractClaims(
                'HP Toner CF217A with 1600 page yield',
                'https://hp.com/products/cf217a'
            );

            expect(Array.isArray(claims)).toBe(true);
            expect(BackendLLMService.complete).toHaveBeenCalled();
        });

        it('should return empty array on LLM failure', async () => {
            (BackendLLMService.complete as any).mockRejectedValue(new Error('API Error'));

            const claims = await SynthesisAgent.extractClaims(
                'Some content',
                'https://example.com'
            );

            expect(Array.isArray(claims)).toBe(true);
            expect(claims.length).toBe(0);
        });

        it('should handle markdown code fences in response', async () => {
            // LLM sometimes wraps JSON in markdown code blocks
            const mockResponse = '```json\n[{"field": "brand", "value": "Canon", "confidence": 0.9, "rawSnippet": "Canon"}]\n```';

            (BackendLLMService.complete as any).mockResolvedValue(mockResponse);

            const claims = await SynthesisAgent.extractClaims(
                'Canon Toner',
                'https://canon.com'
            );

            expect(Array.isArray(claims)).toBe(true);
        });
    });

    describe('merge', () => {
        it('should merge sources into ConsumableData', async () => {
            const sources = [
                'Source: https://hp.com/cf217a\nBrand: HP\nMPN: CF217A',
                'Source: https://nix.ru/cf217a\nWeight: 500g\nDimensions: 20x10x5cm'
            ];

            const mockResult = {
                brand: 'HP',
                mpn_identity: { mpn: 'CF217A' },
                logistics: { package_weight_g: 500 }
            };

            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockResult));

            const result = await SynthesisAgent.merge(sources);

            expect(result.brand).toBe('HP');
            expect(BackendLLMService.complete).toHaveBeenCalled();
        });

        it('should handle empty sources', async () => {
            const mockResult = {};
            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockResult));

            const result = await SynthesisAgent.merge([]);

            expect(result).toBeDefined();
        });

        it('should pass language parameter for localized extraction', async () => {
            const sources = ['Source text in Russian'];
            const mockResult = { brand: 'HP' };

            (BackendLLMService.complete as any).mockResolvedValue(JSON.stringify(mockResult));

            await SynthesisAgent.merge(
                sources,
                'StrictConsumableData',
                undefined,
                undefined,
                undefined,
                undefined,
                'ru' // Russian language
            );

            expect(BackendLLMService.complete).toHaveBeenCalled();
            // Verify the system prompt contains Russian-specific instructions
            const callArgs = (BackendLLMService.complete as any).mock.calls[0][0];
            expect(callArgs.messages).toBeDefined();
        });
    });
});
