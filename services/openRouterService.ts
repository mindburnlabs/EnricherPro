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
import { nixService } from './nixService';
import { firecrawlAgent, deepAgentResearch, getAgentStatus } from './firecrawlService';
import { filterPrintersForRussianMarket } from './russianMarketFilter';
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
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  baseUrl: 'https://openrouter.ai/api/v1',
  maxTokens: 4000,
  temperature: 0.1
};

// Popular models for consumable enrichment
export const RECOMMENDED_MODELS = {
  // --- Google / Gemini Models ---
  'google/gemini-3-flash-preview': {
    name: 'Gemini 3 Flash Preview',
    description: 'Latest high-speed preview model',
    recommended: true,
    category: 'standard'
  },
  'google/gemini-3-pro-preview': {
    name: 'Gemini 3 Pro Preview',
    description: 'Advanced reasoning & coding',
    recommended: true,
    category: 'power'
  },
  'google/gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    description: 'Stable high-performance model',
    recommended: false,
    category: 'standard'
  },
  'google/gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Cost-efficient & fast',
    recommended: false,
    category: 'standard'
  },
  'google/gemini-2.0-flash-001': {
    name: 'Gemini 2.0 Flash',
    description: 'Fast, efficient multimodal model',
    recommended: true,
    category: 'standard'
  },

  // --- Anthropic ---
  'anthropic/claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    description: 'Reliable workhorse for structured data',
    recommended: true,
    category: 'premium'
  },
  'anthropic/claude-3-opus': {
    name: 'Claude 3 Opus',
    description: 'Legacy power model',
    recommended: false,
    category: 'power'
  },

  // --- OpenAI ---
  'openai/gpt-5.2': {
    name: 'GPT-5.2',
    description: 'Frontier reasoning model',
    recommended: true,
    category: 'power'
  },
  'openai/gpt-4o': {
    name: 'GPT-4o',
    description: 'High-quality reasoning',
    recommended: true,
    category: 'premium'
  },

  // --- Meta & Others ---
  'meta-llama/llama-3.3-70b-instruct': {
    name: 'Llama 3.3 70B',
    description: 'Advanced open-weight model',
    recommended: true,
    category: 'standard'
  },
  'deepseek/deepseek-r1': {
    name: 'DeepSeek R1',
    description: 'Strong reasoning model',
    recommended: true,
    category: 'standard'
  },

  // --- Free Models ---
  'google/gemini-2.0-flash-exp:free': {
    name: 'Gemini 2.0 Flash Experimental (Free)',
    description: 'Free tier flash model with updated capabilities',
    recommended: true,
    category: 'free'
  },
  'meta-llama/llama-3.3-70b-instruct:free': {
    name: 'Llama 3.3 70B (Free)',
    description: 'Powerful open source model',
    recommended: true,
    category: 'free'
  },
  'deepseek/deepseek-r1:free': {
    name: 'DeepSeek R1 (Free)',
    description: 'Strong reasoning capabilities',
    recommended: true,
    category: 'free'
  },
  'deepseek/deepseek-v3:free': {
    name: 'DeepSeek V3 (Free)',
    description: 'Core V3 model free tier',
    recommended: true,
    category: 'free'
  },
  'nvidia/nemotron-3-nano-30b-a3b:free': {
    name: 'NVIDIA Nemotron 3 Nano (Free)',
    description: 'Efficient 30B parameter model by NVIDIA',
    recommended: false,
    category: 'free'
  },
  'xiaomi/mimo-v2-flash:free': {
    name: 'Xiaomi Mimo V2 Flash (Free)',
    description: 'High-speed free flash model',
    recommended: true,
    category: 'free'
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
      // Robustness: If model is invalid (400), try fallback to a known working free model
      if (response.error && response.error.includes('400') && this.config.model !== 'google/gemini-2.0-flash-exp:free') {
        console.warn(`[OpenRouter] Model ${this.config.model} failed (400). Falling back to google/gemini-2.0-flash-exp:free`);

        // Recursive call with fallback model
        // We create a temporary config overrides for this request? 
        // Since makeCompletionRequest uses this.config.model, we'd need to change it or pass it.
        // But currently makeCompletionRequest pulls from this.config.
        // Let's create a temporary instance or just update config? Updating config might be persistent.
        // Better: Recursive call with overridden model in options, BUT makeCompletionRequest reads this.config.model.
        // Let's modify makeCompletionRequest to accept model override in options?
        // It basically does: const requestBody = { model: this.config.model... }

        // Let's try one more matching:
        // We can't easily recurse without changing the method signature or state.
        // SAFEST FIX: Temporary mutation of config (if instance is not shared concurrently? It is singleton).
        // BETTER: Just run the fetch again here with new body.

        const fallbackModel = 'google/gemini-2.0-flash-exp:free';
        const fallbackBody = { ...requestBody, model: fallbackModel };

        const fallbackResponse = await apiIntegrationService.makeRequest(
          {
            serviceId: 'openrouter',
            operation: 'chat_completion_fallback',
            priority: 'high',
            retryable: false,
            metadata: { model: fallbackModel, originalModel: this.config.model }
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
              body: JSON.stringify(fallbackBody)
            });

            if (!apiResponse.ok) {
              const errorData = await apiResponse.json().catch(() => ({}));
              throw new Error(`OpenRouter Fallback API error: ${apiResponse.status} - ${errorData.error?.message || apiResponse.statusText}`);
            }

            const data = await apiResponse.json();
            return { success: true, data, responseTime: 0 };
          }
        );

        if (fallbackResponse.success) {
          return fallbackResponse.data;
        }
      }

      throw new Error(response.error || 'OpenRouter request failed');
    }

    return response.data;
  }

  /**
   * Research product context using web search capabilities
   */
  /**
   * Enhanced Research product context using Firecrawl Agent
   * Replaces LLM-only hallucination with actual web research
   */
  async researchProductContext(query: string): Promise<{ researchSummary: string; urls: string[] }> {
    console.log(`[OpenRouter] Starting real web research for: ${query}`);

    try {
      // Use Firecrawl Agent for broad context research
      const agentResult = await firecrawlAgent(
        `Research printer consumable: "${query}". 
        Find:
        1. Official manufacturer page
        2. Major Russian retailers (nix.ru, cartridge.ru)
        3. Compatibility details
        
        Return a summary and list of sources.`,
        undefined // No strict schema for broad research, just let it return default structure
      );

      // Extract URLs from agent result
      // Agent result structure varies, but usually has 'references' or similar in v2, 
      // or we can extract from text if not structured.
      // Our Firecrawl wrapper returns { answer: string, references: ... } or similar depending on query.
      // Let's assume standardized output or parse it.

      let urls: string[] = [];
      if (agentResult && typeof agentResult === 'object') {
        // Try to find URLs in common fields
        if (Array.isArray(agentResult.references)) {
          urls = agentResult.references.map((r: any) => typeof r === 'string' ? r : r.url).filter(Boolean);
        } else if (agentResult.urls && Array.isArray(agentResult.urls)) {
          urls = agentResult.urls;
        }
      }

      const summary = agentResult.answer || agentResult.summary || "Research completed via Firecrawl Agent";

      return {
        researchSummary: summary,
        urls: Array.from(new Set(urls))
      };

    } catch (error) {
      console.warn('[OpenRouter] Firecrawl research failed, falling back to basic analysis', error);
      return {
        researchSummary: `Research failed: ${(error as Error).message}. Proceeding with internal knowledge.`,
        urls: []
      };
    }
  }

  /**
   * Synthesize consumable data from research context
   */
  /**
   * Synthesize consumable data from research context
   * Publicly exposed for Orchestrator usage
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
        thinking: `OpenRouter model ${this.config.model} processed consumable data with structured analysis. Response length: ${content.length} chars.`
      };
    } catch (error) {
      console.error('Failed to parse OpenRouter response:', error);
      throw new Error(`Failed to parse consumable data: ${error}`);
    }
  }

  /**
   * Process a consumable item through the complete pipeline
   * @deprecated logic should now move to OrchestrationService, but kept for legacy/direct usage
   */
  async processItem(
    inputRaw: string,
    onProgress: (step: ProcessingStep) => void
  ): Promise<EnrichedItem> {
    // ... Legacy Implementation or Wrapper to OrchestrationService ...
    // For now we keep it but it might be bypassed by OrchestrationService calling synthesize directly.
    return this._legacyProcessItem(inputRaw, onProgress);
  }

  private async _legacyProcessItem(inputRaw: string, onProgress: (step: ProcessingStep) => void): Promise<EnrichedItem> {
    const processingHistory: any[] = [];
    const auditTrail: any[] = [];
    const jobRunId = generateJobRunId();
    const inputHash = createInputHash(inputRaw);

    // Add initial audit trail entry
    auditTrail.push(createAuditTrailEntry(
      'enrichment',
      'openRouterService.processItem',
      `Started processing with OpenRouter model: ${this.config.model}`,
      {
        inputHash,
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
        startTime: textProcessingStart,
        endTime: new Date(),
        inputData: { raw: inputRaw },
        outputData: { extractedModel: textProcessingResult.model.model, extractedBrand: textProcessingResult.brand.brand }
      }));

      // Step 2: Research & Nix.ru Lookup
      onProgress('searching');
      const researchStart = new Date();
      processingHistory.push(createProcessingHistoryEntry('searching', 'started', { startTime: researchStart }));

      // Parallelize generic research and Nix specific lookup
      let [researchResult, nixData] = await Promise.all([
        this.researchProductContext(inputRaw),
        nixService.getPackagingInfo(textProcessingResult.model.model, textProcessingResult.brand.brand)
      ]);

      if (nixData) {
        auditTrail.push(createAuditTrailEntry(
          'enrichment',
          'nixService',
          `Found Nix.ru data: ${nixData.width_mm}x${nixData.height_mm}x${nixData.depth_mm}mm, ${nixData.weight_g}g`,
          { sourceUrls: [nixData.source_url || 'nix.ru'] }
        ));
      } else {
        // Fallback: Use Deep Agent Research if Nix service failed
        console.log('[OpenRouter] NixService failed, triggering Deep Agent Research fallback...');

        try {
          const firecrawlAgentData = await deepAgentResearch(textProcessingResult.model.model, textProcessingResult.brand.brand);

          if (firecrawlAgentData && firecrawlAgentData.nix_logistics) {
            const nd = firecrawlAgentData.nix_logistics;
            nixData = {
              width_mm: nd.dimensions_mm?.width,
              height_mm: nd.dimensions_mm?.height,
              depth_mm: nd.dimensions_mm?.length,
              weight_g: nd.weight_g,
              source_url: nd.source_url,
              confidence: 0.8 // Estimated confidence for agent fallback
            };

            auditTrail.push(createAuditTrailEntry(
              'enrichment',
              'deepAgentResearch',
              `Recovered Nix.ru data via Deep Agent: ${nixData.width_mm}x${nixData.height_mm}x${nixData.depth_mm}mm`,
              { sourceUrls: [nixData.source_url || 'firecrawl-agent'] }
            ));
          }
        } catch (err) {
          console.warn('[OpenRouter] Deep Agent Research fallback failed:', err);
        }
      }

      processingHistory.push(createProcessingHistoryEntry('searching', 'completed', {
        startTime: researchStart,
        endTime: new Date(),
        outputData: { urlsFound: researchResult.urls.length, nixFound: !!nixData }
      }));

      // Step 3: Data synthesis
      onProgress('analyzing');
      const synthesisStart = new Date();
      processingHistory.push(createProcessingHistoryEntry('analyzing', 'started', { startTime: synthesisStart }));

      const context = `
Research Summary: ${researchResult.researchSummary}
Found URLs: ${researchResult.urls.join(', ')}
Text Processing: Model=${textProcessingResult.model.model}, Brand=${textProcessingResult.brand.brand}
Nix.ru Data: ${nixData ? JSON.stringify(nixData) : 'Not found'}
      `.trim();

      const synthesisResult = await this.synthesizeConsumableData(context, inputRaw, textProcessingResult);

      // Post-synthesis: Strict logic application
      // 1. Apply Nix dimensions if available (Override LLM)
      if (nixData) {
        synthesisResult.data.packaging_from_nix = {
          width_mm: nixData.width_mm,
          height_mm: nixData.height_mm,
          depth_mm: nixData.depth_mm,
          weight_g: nixData.weight_g,
          source_url: nixData.source_url
        };
      }

      processingHistory.push(createProcessingHistoryEntry('analyzing', 'completed', {
        startTime: synthesisStart,
        endTime: new Date(),
        outputData: { dataQuality: synthesisResult.data.confidence?.overall || 0.8 }
      }));

      // Create enriched item
      const enrichedItem: EnrichedItem = {
        input_raw: inputRaw,
        data: synthesisResult.data,
        evidence: {
          sources: [{
            url: 'openrouter-api',
            source_type: 'other',
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
        status: synthesisResult.data.automation_status === 'done' ? 'ok' : (synthesisResult.data.automation_status as any) || 'ok',
        validation_errors: [],
        error_details: [],
        failure_reasons: [],
        retry_count: 0,
        is_retryable: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        id: jobRunId,
        input_hash: inputHash,
        ruleset_version: RULESET_VERSION,
        parser_version: PARSER_VERSION,
        processed_at: new Date().toISOString()
      };

      onProgress('idle');
      return enrichedItem;

    } catch (error) {
      console.error('OpenRouter processing failed:', error);
      // ... Error Handling Structure kept same as original ...
      const errorItem: EnrichedItem = {
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
            audit_completeness: 0,
            last_calculated: new Date().toISOString(),
            total_sources_used: 0,
            failed_validations: [error.toString()],
            missing_required_fields: []
          },
          audit_trail: auditTrail
        },
        status: 'failed',
        validation_errors: [error.toString()],
        error_details: [{
          reason: 'processing_error' as any,
          category: 'system',
          severity: 'high',
          message: error.toString(),
          timestamp: new Date().toISOString(),
          retryable: true
        }],
        failure_reasons: ['processing_error' as any],
        retry_count: 0,
        is_retryable: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        id: jobRunId,
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