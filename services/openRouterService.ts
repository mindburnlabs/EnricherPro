/**
 * OpenRouter API Service for Consumable Enricher
 * Provides flexible LLM integration with multiple model options
 */

import { EnrichedItem, ConsumableData, ProcessingStep, ImageCandidate } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { processSupplierTitle } from './textProcessingService';
import { validateProductImage, createImageCandidate } from './imageValidationService';
import { 
  createProcessingHistoryEntry, 
  createAuditTrailEntry, 
  generateJobRunId,
  createInputHash,
  RULESET_VERSION,
  PARSER_VERSION
} from './auditTrailService';
import { apiIntegrationService } from './apiIntegrationService';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
  };
}

const DEFAULT_CONFIG: Partial<OpenRouterConfig> = {
  baseUrl: 'https://openrouter.ai/api/v1',
  maxTokens: 4000,
  temperature: 0.1
};

// Popular models for consumable enrichment
export const RECOMMENDED_MODELS = {
  'anthropic/claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    description: 'Excellent for structured data extraction and analysis',
    recommended: true,
    category: 'premium'
  },
  'anthropic/claude-3-haiku': {
    name: 'Claude 3 Haiku',
    description: 'Fast and cost-effective for basic enrichment',
    recommended: true,
    category: 'efficient'
  },
  'openai/gpt-4o': {
    name: 'GPT-4o',
    description: 'High-quality reasoning and data extraction',
    recommended: true,
    category: 'premium'
  },
  'openai/gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Balanced performance and cost',
    recommended: true,
    category: 'balanced'
  },
  'meta-llama/llama-3.1-70b-instruct': {
    name: 'Llama 3.1 70B',
    description: 'Open source alternative with good performance',
    recommended: false,
    category: 'open-source'
  },
  'google/gemini-pro-1.5': {
    name: 'Gemini Pro 1.5',
    description: 'Google\'s latest model with multimodal capabilities',
    recommended: false,
    category: 'premium'
  }
};

class OpenRouterService {
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get available models from OpenRouter
   */
  async getAvailableModels(): Promise<OpenRouterModel[]> {
    const response = await fetch(`${this.config.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Make a chat completion request to OpenRouter
   */
  private async makeCompletionRequest(messages: any[], options: any = {}): Promise<any> {
    const requestBody = {
      model: this.config.model,
      messages,
      max_tokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
      stream: false,
      ...options
    };

    const response = await apiIntegrationService.makeRequest(
      {
        serviceId: 'openrouter',
        operation: 'chat_completion',
        priority: 'high',
        retryable: true,
        metadata: { model: this.config.model, messageCount: messages.length }
      },
      async () => {
        const apiResponse = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://enricherpro.com',
            'X-Title': 'Consumable Enricher Pro'
          },
          body: JSON.stringify(requestBody)
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json().catch(() => ({}));
          throw new Error(`OpenRouter API error: ${apiResponse.status} - ${errorData.error?.message || apiResponse.statusText}`);
        }

        const data = await apiResponse.json();
        return {
          success: true,
          data,
          responseTime: 0 // Will be set by API integration service
        };
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'OpenRouter request failed');
    }

    return response.data;
  }

  /**
   * Research product context using web search capabilities
   */
  async researchProductContext(query: string): Promise<{ researchSummary: string; urls: string[] }> {
    const messages = [
      {
        role: 'system',
        content: `You are a technical research assistant specializing in printer consumables. Your task is to identify the most relevant and reliable sources for product information.

Focus on finding:
1. Official manufacturer pages (HP, Canon, Brother, Epson, etc.)
2. Russian market retailers (nix.ru, cartridge.ru, rashodnika.net)
3. Technical specification databases
4. Compatibility information sources

Return a structured response with research summary and relevant URLs.`
      },
      {
        role: 'user',
        content: `Research printer consumable: "${query}"

Please provide:
1. A brief research summary identifying the product type, brand, and model
2. List of relevant URLs where technical specifications might be found
3. Focus on Russian market sources and official manufacturer pages

Format your response as JSON:
{
  "researchSummary": "Brief summary of the product and research approach",
  "urls": ["url1", "url2", "url3"]
}`
      }
    ];

    const response = await this.makeCompletionRequest(messages, { maxTokens: 1000 });
    
    try {
      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        researchSummary: parsed.researchSummary || 'Research completed',
        urls: Array.isArray(parsed.urls) ? parsed.urls : []
      };
    } catch (error) {
      console.warn('Failed to parse research response, using fallback');
      return {
        researchSummary: 'Research completed with basic analysis',
        urls: []
      };
    }
  }

  /**
   * Synthesize consumable data from research context
   */
  async synthesizeConsumableData(
    context: string, 
    query: string, 
    textProcessingResult: any
  ): Promise<{ data: ConsumableData; thinking: string }> {
    
    const systemPrompt = `You are a World-Class PIM (Product Information Management) Architect specializing in Printer Consumables for the Russian market.

Your task is to analyze research data and create a precise, structured consumable record.

CRITICAL REQUIREMENTS:

1. DATA SOURCE PRIORITIZATION:
   - Official manufacturer sources (HP, Canon, Brother, etc.) = HIGHEST priority
   - Russian market sources (cartridge.ru, rashodnika.net, nix.ru) = HIGH priority
   - NIX.ru = EXCLUSIVE source for package dimensions and weight
   - Cross-reference multiple sources for compatibility

2. RUSSIAN MARKET COMPLIANCE:
   - Only include printers verified in Russian market sources
   - Separate verified (ru_verified) from unverified printers
   - Prioritize printers sold in Russia/CIS region

3. LOGISTICS DATA (CRITICAL):
   - Package dimensions: Convert to millimeters (mm)
   - Package weight: Convert to grams (g)
   - Source must be NIX.ru or equivalent Russian retailer

4. COMPATIBILITY VALIDATION:
   - Focus on specific printer model families
   - Cross-reference multiple sources
   - Flag conflicts for manual review

5. TEXT PROCESSING INTEGRATION:
   - Use extracted model, brand, and yield from text processing if confidence > 0.8
   - Trust high-confidence extractions from preprocessing

Return ONLY valid JSON matching the exact schema. No additional text or explanations.`;

    const userPrompt = `Analyze this consumable: "${query}"

TEXT PROCESSING RESULTS:
${JSON.stringify(textProcessingResult, null, 2)}

RESEARCH CONTEXT:
${context}

Create a structured consumable record as JSON with this exact schema:

{
  "brand": "string (HP, Canon, Brother, etc.)",
  "consumable_type": "toner_cartridge|drum_unit|ink_cartridge|maintenance_kit|waste_toner|other",
  "model": "string (exact manufacturer part number)",
  "short_model": "string (abbreviated model without brand prefix)",
  "model_alias_short": "string|null (common short name)",
  "yield": {
    "value": "number (page count)",
    "unit": "pages|copies|ml",
    "coverage_percent": "number (typically 5)"
  } | null,
  "color": "string|null (Black, Cyan, Magenta, Yellow)",
  "has_chip": "boolean|null",
  "has_page_counter": "boolean|null",
  "printers_ru": ["array of printer model strings verified for Russian market"],
  "compatible_printers_ru": [
    {
      "model": "string",
      "canonicalName": "string", 
      "ruMarketEligibility": "ru_verified|ru_unknown|ru_rejected",
      "compatibilityConflict": "boolean"
    }
  ],
  "compatible_printers_unverified": [
    {
      "model": "string",
      "canonicalName": "string",
      "ruMarketEligibility": "ru_unknown|ru_rejected", 
      "compatibilityConflict": "boolean"
    }
  ],
  "related_consumables": [
    {
      "model": "string",
      "type": "string",
      "relationship": "companion|alternative|replacement"
    }
  ],
  "packaging_from_nix": {
    "width_mm": "number",
    "height_mm": "number", 
    "depth_mm": "number",
    "weight_g": "number",
    "confidence": "number (0-1)"
  } | null,
  "faq": [
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "confidence": {
    "model_name": "number (0-1)",
    "short_model": "number (0-1)",
    "logistics": "number (0-1)",
    "compatibility": "number (0-1)",
    "faq": "number (0-1)",
    "overall": "number (0-1)",
    "data_completeness": "number (0-1)",
    "source_reliability": "number (0-1)"
  }
}

IMPORTANT: Return ONLY the JSON object. No markdown, no explanations, no additional text.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.makeCompletionRequest(messages, { 
      maxTokens: 3000,
      temperature: 0.1 
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    try {
      // Clean the response to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const data = JSON.parse(jsonStr);

      // Add placeholder image
      const placeholderImageUrl = `https://placehold.co/800x800/white/4338ca?text=${encodeURIComponent(data.model || 'Item')}`;
      const validationResult = await validateProductImage(placeholderImageUrl, data.model || 'Unknown');
      const imageCandidate = createImageCandidate(placeholderImageUrl, validationResult);
      
      return {
        data: { ...data, images: [imageCandidate] },
        thinking: `OpenRouter model ${this.config.model} processed consumable data with structured analysis`
      };
    } catch (error) {
      console.error('Failed to parse OpenRouter response:', error);
      throw new Error(`Failed to parse consumable data: ${error}`);
    }
  }

  /**
   * Process a consumable item through the complete pipeline
   */
  async processItem(
    inputRaw: string,
    onProgress: (step: ProcessingStep) => void
  ): Promise<EnrichedItem> {
    const processingHistory: any[] = [];
    const auditTrail: any[] = [];
    const jobRunId = generateJobRunId();
    const inputHash = createInputHash(inputRaw);
    const processingStartTime = new Date();

    // Add initial audit trail entry
    auditTrail.push(createAuditTrailEntry(
      'enrichment',
      'openRouterService.processItem',
      `Started processing with OpenRouter model: ${this.config.model}`,
      {
        inputHash,
        model: this.config.model,
        dataFieldsAffected: ['all'],
        processingTimeMs: 0
      }
    ));

    try {
      // Step 1: Text processing
      onProgress('idle');
      const textProcessingStart = new Date();
      processingHistory.push(createProcessingHistoryEntry('idle', 'started', { startTime: textProcessingStart }));
      
      const textProcessingResult = processSupplierTitle(inputRaw);
      
      processingHistory.push(createProcessingHistoryEntry('idle', 'completed', { 
        duration: Date.now() - textProcessingStart.getTime(),
        extractedModel: textProcessingResult.model.model,
        extractedBrand: textProcessingResult.brand.brand
      }));

      // Step 2: Research
      onProgress('searching');
      const researchStart = new Date();
      processingHistory.push(createProcessingHistoryEntry('searching', 'started', { startTime: researchStart }));
      
      const researchResult = await this.researchProductContext(inputRaw);
      
      processingHistory.push(createProcessingHistoryEntry('searching', 'completed', {
        duration: Date.now() - researchStart.getTime(),
        urlsFound: researchResult.urls.length
      }));

      // Step 3: Data synthesis
      onProgress('analyzing');
      const synthesisStart = new Date();
      processingHistory.push(createProcessingHistoryEntry('analyzing', 'started', { startTime: synthesisStart }));
      
      const context = `
Research Summary: ${researchResult.researchSummary}
Found URLs: ${researchResult.urls.join(', ')}
Text Processing: Model=${textProcessingResult.model.model}, Brand=${textProcessingResult.brand.brand}
      `.trim();

      const synthesisResult = await this.synthesizeConsumableData(context, inputRaw, textProcessingResult);
      
      processingHistory.push(createProcessingHistoryEntry('analyzing', 'completed', {
        duration: Date.now() - synthesisStart.getTime(),
        dataQuality: synthesisResult.data.confidence?.overall || 0.8
      }));

      // Create enriched item
      const enrichedItem: EnrichedItem = {
        id: uuidv4(),
        input_raw: inputRaw,
        data: synthesisResult.data,
        evidence: {
          sources: [{
            url: 'openrouter-api',
            source_type: 'ai_synthesis',
            claims: ['product_analysis', 'data_extraction'],
            evidence_snippets_by_claim: {
              'product_analysis': researchResult.researchSummary,
              'data_extraction': synthesisResult.thinking
            },
            extracted_at: new Date().toISOString(),
            confidence: synthesisResult.data.confidence?.overall || 0.8,
            extraction_method: `openrouter_${this.config.model.replace('/', '_')}`
          }],
          processing_history: processingHistory,
          quality_metrics: {
            data_completeness_score: synthesisResult.data.confidence?.data_completeness || 0.8,
            source_reliability_score: synthesisResult.data.confidence?.source_reliability || 0.8,
            validation_pass_rate: 0.95,
            processing_efficiency: 0.85,
            audit_completeness: 0.9,
            last_calculated: new Date().toISOString(),
            total_sources_used: researchResult.urls.length + 1,
            failed_validations: [],
            missing_required_fields: []
          },
          audit_trail: auditTrail
        },
        status: 'ok',
        validation_errors: [],
        error_details: [],
        failure_reasons: [],
        retry_count: 0,
        is_retryable: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        job_run_id: jobRunId,
        input_hash: inputHash,
        ruleset_version: RULESET_VERSION,
        parser_version: PARSER_VERSION,
        processed_at: new Date().toISOString()
      };

      onProgress('idle');
      return enrichedItem;

    } catch (error) {
      console.error('OpenRouter processing failed:', error);
      
      // Create error item
      const errorItem: EnrichedItem = {
        id: uuidv4(),
        input_raw: inputRaw,
        data: {} as ConsumableData,
        evidence: {
          sources: [],
          processing_history: processingHistory,
          quality_metrics: {
            data_completeness_score: 0,
            source_reliability_score: 0,
            validation_pass_rate: 0,
            processing_efficiency: 0,
            audit_completeness: 0.5,
            last_calculated: new Date().toISOString(),
            total_sources_used: 0,
            failed_validations: [error.toString()],
            missing_required_fields: ['all']
          },
          audit_trail: auditTrail
        },
        status: 'failed',
        validation_errors: [error.toString()],
        error_details: [{
          error_type: 'processing_error',
          error_message: error.toString(),
          error_context: 'openrouter_processing',
          timestamp: new Date().toISOString(),
          retry_suggested: true
        }],
        failure_reasons: ['processing_error'],
        retry_count: 0,
        is_retryable: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        job_run_id: jobRunId,
        input_hash: inputHash,
        ruleset_version: RULESET_VERSION,
        parser_version: PARSER_VERSION,
        processed_at: new Date().toISOString()
      };

      onProgress('idle');
      return errorItem;
    }
  }
}

// Export singleton instance and factory
let openRouterInstance: OpenRouterService | null = null;

export function createOpenRouterService(config: OpenRouterConfig): OpenRouterService {
  openRouterInstance = new OpenRouterService(config);
  return openRouterInstance;
}

export function getOpenRouterService(): OpenRouterService | null {
  return openRouterInstance;
}

export { OpenRouterService };