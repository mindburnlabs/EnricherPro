import { BackendLLMService, RoutingStrategy } from '../backend/llm.js';
import { safeJsonParse } from '../../lib/json.js';
import { ConsumableDataSchema } from '../../schemas/agent_schemas.js';

export class ExtractorAgent {
  /**
   * Extracts structured SKU data from a raw content snippet.
   * @param content Raw text or HTML snippet
   * @param context Optional context (e.g. supplier string, known metadata)
   */
  static async extract(
    content: string,
    context?: any,
    onLog?: (msg: string) => void,
  ): Promise<any> {
    const systemPrompt = `You are an Expert SKU Data Extractor.
        Your goal is to extract technical specifications for printer consumables (toners, drums, inks) from the provided text.

        Context: ${JSON.stringify(context || {})}

        Extract STRICTLY valid JSON matching the schema.
        - Normalize brands (HP, Canon, Xerox).
        - Extract MPN (Manufacturer Part Number) carefully.
        - Identify Consumable Type (Toner, Drum, etc.).
        - Extract Yield (Page count).
        - Extract Logistics (Weight, Dimensions) if present.

        If a field is not found, omit it or set to null.
        `;

    try {
      const { ModelProfile } = await import('../../config/models.js');

      // Use SMART routing for extraction to ensure high quality (using smaller model if possible, or fallback to larger)
      // 'middle-out' transform helps with long context if needed
      const response = await BackendLLMService.complete({
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Snippet:\n${content.substring(0, 15000)}` }, // Truncate safe limit
        ],
        jsonSchema: ConsumableDataSchema, // Use the strict schema
        routingStrategy: RoutingStrategy.EXTRACTION,
        transforms: ['middle-out'],
        onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined,
      });

      return safeJsonParse(response || '{}');
    } catch (error) {
      console.warn('ExtractorAgent failed:', error);
      // Return empty partial object on failure
      return {};
    }
  }
}
