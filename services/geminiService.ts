
import { GoogleGenAI, Type } from "@google/genai";
import { EnrichedItem, ConsumableData, ProcessingStep, ImageCandidate, RuMarketFilterConfig, ErrorDetail, FailureReason } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { firecrawlScrape, firecrawlAgent, getAgentStatus, deepAgentResearch } from './firecrawlService';
import { processSupplierTitle, NormalizationLog } from './textProcessingService';
export { processSupplierTitle }; // Export for Orchestrator usage
import { nixService, NixPackagingInfo } from './nixService';
import { validateProductImage, createImageCandidate, ImageValidationConfig } from './imageValidationService';
import {
  filterPrintersForRussianMarket,
  verifyRussianMarketEligibility,
  calculatePrinterEligibilityScore
} from './russianMarketFilter';
/**
 * Fetch available models from Gemini API
 */
export async function getAvailableModels(apiKey?: string): Promise<{ id: string; name: string }[]> {
  const key = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null);
  if (!key) throw new Error("No API Key provided");

  // Gemini API list endpoint
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to fetch Gemini models');
  }

  const data = await response.json();
  if (data.models && Array.isArray(data.models)) {
    return data.models
      .filter((m: any) => m.name.includes('gemini')) // Filter ensure it's a Gemini model
      .map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', '')
      }));
  }
  return [];
}
import {
  createAuditTrailEntry,
  createEvidenceSource,
  enhanceItemWithAuditTrail,
  generateJobRunId,
  createInputHash,
  RULESET_VERSION,
  PARSER_VERSION
} from './auditTrailService';
import { createErrorDetail } from './errorHandlingService';
import { discoverRelatedProducts } from './relatedProductsService';
import { apiIntegrationService, createApiIntegrationError } from './apiIntegrationService';
import { createOpenRouterService, OpenRouterService } from './openRouterService';


const getAI = () => {
  const apiKey = (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null) || (import.meta as any).env?.VITE_GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Missing Google API Key");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

const getGeminiModel = () => {
  // User requested "Gemini 3.0". Using the preview model ID.
  return (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_model') : null) || 'gemini-3-flash-preview';
};

const LOGISTICS_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    weight_g: { type: 'number', description: 'Weight in grams.' },
    width_mm: { type: 'number', description: 'Width in millimeters.' },
    height_mm: { type: 'number', description: 'Height in millimeters.' },
    depth_mm: { type: 'number', description: 'Depth in millimeters.' },
    mpn: { type: 'string', description: 'Manufacturer Part Number.' },
    yield_pages: { type: 'number', description: 'Page yield.' }
  },
  required: ['mpn']
};

/**
 * Enhanced research phase with optimized API integration
 * Uses Search Grounding to find primary source URLs with rate limiting and circuit breaker protection
 */
async function researchProductContext(query: string) {
  const ai = getAI();

  // Use the optimized API integration service for Gemini requests
  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'gemini',
      operation: 'researchProductContext',
      priority: 'high',
      retryable: true,
      metadata: { query: query.substring(0, 100) + '...' }
    },
    async () => {
      const geminiResponse = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: `Find technical specification pages for printer consumable: "${query}". 
        Focus on finding:
        1. nix.ru catalog page
        2. Official brand product page (HP, Canon, Brother, etc.)
        3. Major Russian retailers (cartridge.ru, rashodnika.net, onlinetrade.ru)
        
        Return URLs.`,
        config: { tools: [{ googleSearch: {} }] }
      });

      return {
        success: true,
        data: geminiResponse,
        responseTime: 0 // Will be set by API integration service
      };
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Research request failed');
  }

  const geminiResponse = response.data;
  const groundingChunks = geminiResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const urls = groundingChunks
    .filter((c: any) => c.web && c.web.uri)
    .map((c: any) => c.web.uri);

  return { researchSummary: geminiResponse.text, urls: Array.from(new Set(urls)) as string[] };
}


/**
 * Enhanced synthesis phase with optimized API integration and reliable sources integration
 */
/**
 * Enhanced synthesis phase with optimized API integration and reliable sources integration
 */
export async function synthesizeConsumableData(
  context: string,
  query: string,
  textProcessingResult: any,
  firecrawlData?: any,
  feedback?: string
): Promise<{ data: ConsumableData, thinking: string }> {
  const ai = getAI();

  try {
    // Enhanced prompt with reliable sources guidance
    const enhancedPrompt = `You are a World-Class PIM Architect specializing in Printer Consumables.
      Analyze the provided research data to create a high-precision record for "${query}".
      
      ${feedback ? `
      🚨 CRITICAL SELF-CORRECTION MODE 🚨
      Your previous attempt failed Quality Gates with these errors:
      ${feedback}
      
      YOU MUST FIX THESE SPECIFIC ISSUES. Review the research data again. 
      The data IS likely there, you just missed it. Look closer at the "Deep Scrape" sections.
      ` : ''}

      CRITICAL INTEGRATION RULES (per reliable_sources.md and complete_specification.md):
      
      1. DATA SOURCE PRIORITIZATION:
         - OEM sources (HP, Canon, Epson, Kyocera, Brother) = HIGHEST priority
         - Russian market sources (cartridge.ru, rashodnika.net, dns-shop.ru) = HIGH priority  
         - NIX.ru = EXCLUSIVE for logistics (dimensions/weight)
         - Firecrawl agent data = Enhanced fallback with source verification
      
      2. RUSSIAN MARKET FILTERING:
         - Printers must be verified in ≥2 RU sources OR 1 OEM RU source
         - Mark as ru_verified only if criteria met
         - Separate unverified printers into different array
      
      3. LOGISTICS DATA (CRITICAL):
         - Package dimensions: ONLY from NIX.ru sources (convert cm→mm)
         - Package weight: ONLY from NIX.ru sources (convert kg→g)
         - If NIX.ru unavailable → needs_review status
      
      4. ENHANCED FIRECRAWL & CONSENSUS INTEGRATION:
         ${firecrawlData ? `
         - Firecrawl agent provided enhanced research data
         - Prioritize OEM sources found by agent
         - Use agent's source verification for compatibility
         - Trust agent's NIX.ru logistics extraction if available
         ` : ''}
         - If Firecrawl and Perplexity data conflict, prefer Firecrawl for Technical Specs (Yield/Weight) and Perplexity for Market Context (Compatibility).

      5. COMPATIBILITY VALIDATION:
         - Cross-reference multiple sources
         - Flag conflicts for manual review
         - Maintain source provenance for each printer
      
      STRICT RULES:
      1. MPN: Use the extracted model from text processing if confidence > 0.8, otherwise extract from research data.
      2. BRAND: Use the detected brand from text processing if confidence > 0.8, otherwise extract from research data.
      3. COMPATIBILITY: Focus on specific printer model families (e.g., HP LaserJet Pro M102).
      4. LOGISTICS: If conflicting, prioritize NIX.ru data exclusively.
      5. RU MARKET: Ensure compatible printer models match those sold in Russia/CIS.
      6. YIELD: Use extracted yield information from text processing if available.
      7. NORMALIZATION: The input has already been normalized - use the processed version.
      
      The research data includes enhanced text processing results with extracted models, brands, and yield information.
      Trust high-confidence extractions from the text processing pipeline.
      
      ${firecrawlData ? `
      ENHANCED FIRECRAWL AGENT DATA:
      ${JSON.stringify(firecrawlData, null, 2)}
      ` : ''}
      
      RESEARCH DATA:
      ${context}
      
      Return JSON strictly matching the defined schema.`;

    // Use optimized API integration for Gemini synthesis
    const response = await apiIntegrationService.makeRequest(
      {
        serviceId: 'gemini',
        operation: 'synthesizeConsumableData',
        priority: 'high',
        retryable: true,
        metadata: { query: query.substring(0, 100) + '...', hasFirecrawlData: !!firecrawlData }
      },
      async () => {
        const geminiResponse = await ai.models.generateContent({
          model: getGeminiModel(),
          contents: enhancedPrompt,
          config: {
            thinkingConfig: { thinkingBudget: 32768 },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING },
                consumable_type: { type: Type.STRING, enum: ['toner_cartridge', 'drum_unit', 'consumable_set', 'ink_cartridge', 'bottle', 'other'] },
                model: { type: Type.STRING },
                short_model: { type: Type.STRING },
                model_alias_short: { type: Type.STRING, nullable: true },
                yield: {
                  type: Type.OBJECT,
                  properties: {
                    value: { type: Type.NUMBER },
                    unit: { type: Type.STRING, enum: ['pages', 'copies', 'ml'] },
                    coverage_percent: { type: Type.NUMBER }
                  }
                },
                color: { type: Type.STRING },
                has_chip: { type: Type.BOOLEAN },
                has_page_counter: { type: Type.BOOLEAN },
                printers_ru: { type: Type.ARRAY, items: { type: Type.STRING } },
                compatible_printers_ru: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      model: { type: Type.STRING },
                      canonicalName: { type: Type.STRING },
                      ruMarketEligibility: { type: Type.STRING, enum: ['ru_verified', 'ru_unknown', 'ru_rejected'] },
                      compatibilityConflict: { type: Type.BOOLEAN }
                    }
                  }
                },
                compatible_printers_unverified: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      model: { type: Type.STRING },
                      canonicalName: { type: Type.STRING },
                      ruMarketEligibility: { type: Type.STRING, enum: ['ru_verified', 'ru_unknown', 'ru_rejected'] },
                      compatibilityConflict: { type: Type.BOOLEAN }
                    }
                  }
                },
                related_consumables_full: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      model: { type: Type.STRING },
                      type: { type: Type.STRING },
                      relationship: { type: Type.STRING }
                    }
                  }
                },
                packaging_from_nix: {
                  type: Type.OBJECT,
                  properties: {
                    width_mm: { type: Type.NUMBER },
                    height_mm: { type: Type.NUMBER },
                    depth_mm: { type: Type.NUMBER },
                    weight_g: { type: Type.NUMBER },
                    raw_source_string: { type: Type.STRING }
                  }
                },
                faq: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING }
                    }
                  }
                },
                sources: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING },
                      sourceType: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      dataConfirmed: { type: Type.ARRAY, items: { type: Type.STRING } } // simplified for schema
                    }
                  }
                }
              },
              required: ['brand', 'model', 'printers_ru', 'packaging_from_nix', 'sources']
            }
          }
        });

        return {
          success: true,
          data: geminiResponse,
          responseTime: 0 // Will be set by API integration service
        };
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Data synthesis failed');
    }

    const geminiResponse = response.data;
    const raw = JSON.parse(geminiResponse.text || '{}');
    const thinking = (geminiResponse as any).candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.text || "";



    // Enhanced image validation with comprehensive quality checks
    const placeholderImageUrl = `https://placehold.co/800x800/white/4338ca?text=${encodeURIComponent(raw.model || 'Item')}`;

    // Validate the placeholder image using the new validation system
    const validationResult = await validateProductImage(placeholderImageUrl, raw.model || 'Unknown');
    const imageCandidate = createImageCandidate(placeholderImageUrl, validationResult);

    const images: ImageCandidate[] = [imageCandidate];

    return { data: { ...raw, images }, thinking };

  } catch (error) {
    console.warn('Gemini synthesis failed, attempting OpenRouter fallback...', error);

    try {
      // Fallback: Use OpenRouter
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';
      if (!apiKey) throw new Error('OpenRouter API key missing for fallback');

      const openRouter = createOpenRouterService({
        apiKey,
        model: 'openai/gpt-4o' // Default fallback model
      });

      // Use OpenRouter to synthesize data
      return await openRouter.synthesizeConsumableData(context, query, textProcessingResult);

    } catch (fallbackError) {
      console.error('OpenRouter fallback failed:', fallbackError);
      throw error; // Throw the original Gemini error or a combined one? Throw original for clarity or the last error?
      // Let's throw the original or a generic failure.
      throw new Error(`Synthesis failed (Gemini: ${(error as Error).message}, Fallback: ${(fallbackError as Error).message})`);
    }
  }
}

export const analyzeConsumableImage = async (base64Image: string): Promise<string> => {
  const ai = getAI();

  // Use optimized API integration for image analysis
  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'gemini',
      operation: 'analyzeConsumableImage',
      priority: 'medium',
      retryable: true,
      metadata: { imageSize: base64Image.length }
    },
    async () => {
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Examine this image. It is a printer consumable packaging or label. Identify the BRAND and the MANUFACTURER PART NUMBER (MPN). Return only 'BRAND MPN' text." }
        ]
      });

      return {
        success: true,
        data: geminiResponse,
        responseTime: 0 // Will be set by API integration service
      };
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Image analysis failed');
  }

  return response.data.text?.trim() || "Unknown Item";
};

/**
 * Enhanced image analysis with comprehensive validation
 */
export const analyzeAndValidateConsumableImage = async (
  base64Image: string,
  expectedModel?: string
): Promise<{ extractedText: string; validationResult: any; imageCandidate: ImageCandidate }> => {
  const ai = getAI();

  // Use optimized API integration for enhanced image analysis
  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'gemini',
      operation: 'analyzeAndValidateConsumableImage',
      priority: 'medium',
      retryable: true,
      metadata: { imageSize: base64Image.length, hasExpectedModel: !!expectedModel }
    },
    async () => {
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Examine this image. It is a printer consumable packaging or label. Identify the BRAND and the MANUFACTURER PART NUMBER (MPN). Return only 'BRAND MPN' text." }
        ]
      });

      return {
        success: true,
        data: geminiResponse,
        responseTime: 0 // Will be set by API integration service
      };
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Enhanced image analysis failed');
  }

  const extractedText = response.data.text?.trim() || "Unknown Item";

  // Create a data URL for the image
  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

  // Validate the image using our comprehensive validation system
  const validationResult = await validateProductImage(imageDataUrl, expectedModel || extractedText);

  // Create image candidate
  const imageCandidate = createImageCandidate(imageDataUrl, validationResult);

  return {
    extractedText,
    validationResult,
    imageCandidate
  };
};
