import { EnrichedItem } from '../../types/domain.js';
import { BackendLLMService } from '../backend/llm.js';

export class FAQGeneratorAgent {
  static async generateFAQ(
    item: EnrichedItem,
    apiKeys: any,
  ): Promise<{ question: string; answer: string }[]> {
    const context = `
        Product: ${item.data.supplier_title_raw}
        MPN: ${item.data.mpn_identity.mpn}
        Specs: ${JSON.stringify(item.data.tech_specs)}
        Compatibility: ${JSON.stringify(item.data.compatible_printers_ru?.map((p) => p.model))}
        `;

    const prompt = `
        Based on the product technical data below, generate 3-5 helpful FAQ pairs (Question & Answer) for a customer in Russian.
        Focus on compatibility, yield, and installation if inferred.
        Return strictly a JSON array of objects: [{ "question": "...", "answer": "..." }].
        Data:
        ${context}
        `;

    try {
      const result = await BackendLLMService.complete({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: prompt }],
        apiKeys,
        jsonSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
            required: ['question', 'answer'],
          },
        },
      });

      return JSON.parse(result || '[]');
    } catch (e) {
      console.error('FAQ Generation Failed:', e);
      return [];
    }
  }
}
