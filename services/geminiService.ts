
import { GoogleGenAI, Type } from "@google/genai";
import { EnrichedItem, ConsumableData, ProcessingStep, ImageCandidate, RuMarketFilterConfig, ErrorDetail, FailureReason } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { firecrawlScrape, firecrawlAgent, getAgentStatus } from './firecrawlService';
import { processSupplierTitle, NormalizationLog } from './textProcessingService';
import { fetchNIXPackageDataWithRetry, validateNIXExclusivity, NIXPackageData } from './nixService';
import { validateProductImage, createImageCandidate, ImageValidationConfig } from './imageValidationService';
import { 
  filterPrintersForRussianMarket, 
  verifyRussianMarketEligibility,
  calculatePrinterEligibilityScore
} from './russianMarketFilter';
import { getRussianMarketFilterConfig } from './russianMarketConfig';
import { 
  createProcessingHistoryEntry, 
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

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        model: 'gemini-3-flash-preview',
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
 * Enhanced Deep Autonomous Agent Research with reliable sources prioritization.
 * Based on reliable_sources.md and complete_specification.md requirements.
 */
async function deepAgentResearch(query: string, brand?: string): Promise<any> {
  // Prioritized source list based on reliable_sources.md
  const reliableSources = [
    // OEM Sources (HIGHEST PRIORITY)
    'https://support.hp.com/',
    'https://www.canon.com/',
    'https://support.canon.com/',
    'https://www.epson.com/',
    'https://www.kyoceradocumentsolutions.com/',
    'https://support.kyocera.com/',
    'https://www.brother.com/',
    'https://support.brother.com/',
    
    // Russian Market Sources (HIGH PRIORITY)
    'https://cartridge.ru/',
    'https://rashodnika.net/',
    
    // Logistics Source (CRITICAL - NIX.ru exclusive)
    'https://www.nix.ru/',
    'https://max.nix.ru/',
    'https://elets.nix.ru/'
  ];

  const prompt = `CRITICAL RESEARCH TASK for printer consumable: "${query}"${brand ? ` (Brand: ${brand})` : ''}

MANDATORY DATA REQUIREMENTS (per complete_specification.md):
1. EXACT Manufacturer Part Number (MPN) - CRITICAL
2. Package dimensions in mm (L×W×H) - MUST be from NIX.ru ONLY
3. Package weight in grams - MUST be from NIX.ru ONLY  
4. Compatible printer models for RUSSIAN MARKET - verify in ≥2 RU sources
5. Page yield at 5% coverage (if available)
6. Consumable type (toner_cartridge, drum_unit, ink_cartridge, etc.)

PRIORITIZED SOURCE STRATEGY (per reliable_sources.md):
1. OEM SOURCES (HIGHEST PRIORITY): ${brand ? `Focus on ${brand} official sites first` : 'HP, Canon, Epson, Kyocera, Brother official sites'}
2. RUSSIAN MARKET VERIFICATION: cartridge.ru, rashodnika.net for compatibility confirmation
3. LOGISTICS DATA (NIX.ru EXCLUSIVE): Package dimensions/weight ONLY from nix.ru domains
4. Cross-reference multiple sources for compatibility validation

SEARCH TARGETS:
${reliableSources.map(source => `- ${source}`).join('\n')}

VALIDATION RULES:
- Package data: ONLY accept from nix.ru domains (www.nix.ru, max.nix.ru, etc.)
- Compatibility: Require ≥2 Russian sources OR 1 OEM RU source for ru_verified status
- Convert units: cm→mm (×10), kg→g (×1000)
- Prioritize official OEM specifications over third-party data

CRITICAL: If NIX.ru data unavailable, mark as needs_review - do not use alternative sources for logistics.`;

  const schema = {
    type: 'object',
    properties: {
      brand: { type: 'string', description: 'Printer brand (HP, Canon, etc.)' },
      mpn: { type: 'string', description: 'Exact manufacturer part number' },
      consumable_type: { 
        type: 'string', 
        enum: ['toner_cartridge', 'drum_unit', 'ink_cartridge', 'maintenance_kit', 'waste_toner', 'other'],
        description: 'Type of consumable'
      },
      
      // NIX.ru exclusive logistics data
      nix_logistics: {
        type: 'object',
        properties: {
          weight_g: { type: 'number', description: 'Weight in grams from NIX.ru' },
          dimensions_mm: {
            type: 'object',
            properties: {
              length: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' }
            },
            description: 'Dimensions in mm converted from NIX.ru cm data'
          },
          source_url: { type: 'string', description: 'NIX.ru source URL' },
          raw_data: { type: 'string', description: 'Raw text from NIX.ru page' }
        }
      },
      
      // Compatibility with source verification
      compatibility: {
        type: 'object',
        properties: {
          ru_verified_printers: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Printers verified in ≥2 RU sources or 1 OEM RU'
          },
          unverified_printers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Printers found but not verified for RU market'
          },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                source_type: { type: 'string', enum: ['oem', 'cartridge_ru', 'rashodnika_net', 'nix_ru', 'other'] },
                printers_confirmed: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      
      // Additional specifications
      specifications: {
        type: 'object',
        properties: {
          yield_pages: { type: 'number', description: 'Page yield at 5% coverage' },
          color: { type: 'string', description: 'Color (Black, Cyan, Magenta, Yellow)' },
          has_chip: { type: 'boolean', description: 'Has chip' },
          has_page_counter: { type: 'boolean', description: 'Has page counter' }
        }
      },
      
      // Research metadata
      research_quality: {
        type: 'object',
        properties: {
          oem_sources_found: { type: 'number' },
          ru_sources_found: { type: 'number' },
          nix_data_available: { type: 'boolean' },
          confidence_score: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    required: ['mpn', 'brand', 'consumable_type', 'compatibility', 'research_quality']
  };

  console.log('Starting enhanced Firecrawl agent research with reliable sources prioritization...');
  
  const initialResponse = await firecrawlAgent(prompt, schema);
  let status = initialResponse;
  
  // Enhanced polling with better error handling
  let attempts = 0;
  const maxAttempts = 30; // Increased timeout for thorough research
  
  while (status.status === 'processing' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000));
    if (!status.id) break; 
    
    try {
      status = await getAgentStatus(status.id);
      if (status.status === 'failed') {
        throw new Error(`Enhanced agent research failed: ${status.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Agent status check failed (attempt ${attempts + 1}):`, error);
      if (attempts >= maxAttempts - 5) throw error; // Fail if near timeout
    }
    
    attempts++;
  }

  if (status.status === 'processing') {
    throw new Error("Enhanced agent research timed out after comprehensive source analysis.");
  }
  
  console.log('Enhanced Firecrawl agent research completed:', {
    status: status.status,
    dataKeys: Object.keys(status.data || {}),
    attempts
  });
  
  return status.data;
}

/**
 * Enhanced synthesis phase with optimized API integration and reliable sources integration
 */
async function synthesizeConsumableData(context: string, query: string, firecrawlData?: any): Promise<{ data: ConsumableData, thinking: string }> {
  const ai = getAI();
  
  // Enhanced prompt with reliable sources guidance
  const enhancedPrompt = `You are a World-Class PIM Architect specializing in Printer Consumables.
    Analyze the provided research data to create a high-precision record for "${query}".
    
    CRITICAL INTEGRATION RULES (per reliable_sources.md and complete_specification.md):
    
    1. DATA SOURCE PRIORITIZATION:
       - OEM sources (HP, Canon, Epson, Kyocera, Brother) = HIGHEST priority
       - Russian market sources (cartridge.ru, rashodnika.net) = HIGH priority  
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
    
    4. ENHANCED FIRECRAWL INTEGRATION:
       ${firecrawlData ? `
       - Firecrawl agent provided enhanced research data
       - Prioritize OEM sources found by agent
       - Use agent's source verification for compatibility
       - Trust agent's NIX.ru logistics extraction if available
       ` : ''}
    
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
        model: 'gemini-3-pro-preview',
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
              compatible_printers_all: {
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
              related_consumables: {
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
              }
            },
            required: ['brand', 'model', 'printers_ru', 'packaging_from_nix']
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
}

export const processItem = async (
  inputRaw: string, 
  onProgress: (step: ProcessingStep) => void
): Promise<EnrichedItem> => {
  // Initialize audit trail tracking
  const processingHistory: any[] = [];
  const auditTrail: any[] = [];
  const jobRunId = generateJobRunId();
  const inputHash = createInputHash(inputRaw);
  const processingStartTime = new Date();

  // Add initial audit trail entry
  auditTrail.push(createAuditTrailEntry(
    'enrichment',
    'geminiService.processItem',
    `Started processing item with job ID: ${jobRunId}`,
    {
      inputHash,
      dataFieldsAffected: ['all'],
      processingTimeMs: 0
    }
  ));

  try {
    // Step 0: Enhanced text processing and normalization
    const textProcessingStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('idle', 'started', { startTime: textProcessingStart }));
    onProgress('idle');
    
    const textProcessingResult = processSupplierTitle(inputRaw);
    
    const textProcessingEnd = new Date();
    processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
      'idle', 
      'completed', 
      {
        startTime: textProcessingStart,
        endTime: textProcessingEnd,
        inputData: inputRaw,
        outputData: textProcessingResult,
        confidenceBefore: 0,
        confidenceAfter: (textProcessingResult.model.confidence + textProcessingResult.brand.confidence) / 2,
        dataChanges: ['normalized_title', 'extracted_model', 'detected_brand', 'yield_info']
      }
    );

    auditTrail.push(createAuditTrailEntry(
      'data_extraction',
      'textProcessingService.processSupplierTitle',
      `Extracted model: ${textProcessingResult.model.model} (confidence: ${textProcessingResult.model.confidence}), brand: ${textProcessingResult.brand.brand} (confidence: ${textProcessingResult.brand.confidence})`,
      {
        inputHash,
        confidenceImpact: (textProcessingResult.model.confidence + textProcessingResult.brand.confidence) / 2,
        dataFieldsAffected: ['model', 'brand', 'yield'],
        processingTimeMs: textProcessingEnd.getTime() - textProcessingStart.getTime()
      }
    ));
    
    // Use the normalized title for further processing
    const processedTitle = textProcessingResult.normalized;
    
    // Step 1: Research Phase
    const researchStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('searching', 'started', { startTime: researchStart }));
    onProgress('searching');
    
    const { researchSummary, urls } = await researchProductContext(processedTitle);
    
    const researchEnd = new Date();
    processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
      'searching',
      'completed',
      {
        startTime: researchStart,
        endTime: researchEnd,
        inputData: processedTitle,
        outputData: { researchSummary, urls },
        dataChanges: ['research_urls', 'grounding_metadata']
      }
    );

    auditTrail.push(createAuditTrailEntry(
      'data_extraction',
      'geminiService.researchProductContext',
      `Found ${urls.length} research URLs through search grounding`,
      {
        sourceUrls: urls,
        dataFieldsAffected: ['grounding_metadata'],
        processingTimeMs: researchEnd.getTime() - researchStart.getTime()
      }
    ));
    
    let combinedContent = `[RESEARCH OVERVIEW]\n${researchSummary}\n\n`;
    
    // Add text processing results to context
    combinedContent += `[TEXT PROCESSING RESULTS]\n`;
    combinedContent += `Original: ${inputRaw}\n`;
    combinedContent += `Normalized: ${processedTitle}\n`;
    combinedContent += `Extracted Model: ${textProcessingResult.model.model} (confidence: ${textProcessingResult.model.confidence})\n`;
    combinedContent += `Detected Brand: ${textProcessingResult.brand.brand} (confidence: ${textProcessingResult.brand.confidence})\n`;
    if (textProcessingResult.yieldInfo.length > 0) {
      combinedContent += `Yield Information: ${textProcessingResult.yieldInfo.map(y => `${y.value} ${y.unit}`).join(', ')}\n`;
    }
    combinedContent += `\n`;
    
    const evidenceSources: any[] = [];
    
    // Enhanced NIX.ru integration with exclusive sourcing and Firecrawl fallback
    let nixPackageData: NIXPackageData | null = null;
    let firecrawlAgentData: any = null;
    
    // Step 2: NIX.ru Data Extraction
    const nixStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('scraping_nix', 'started', { startTime: nixStart }));
    onProgress('scraping_nix');
    
    try {
      // Primary attempt: Use the enhanced NIX service for exclusive sourcing
      nixPackageData = await fetchNIXPackageDataWithRetry(
        textProcessingResult.model.model || processedTitle,
        textProcessingResult.brand.brand || 'Unknown'
      );
      
      const nixEnd = new Date();
      
      if (nixPackageData && validateNIXExclusivity(nixPackageData.source_url)) {
        processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
          'scraping_nix',
          'completed',
          {
            startTime: nixStart,
            endTime: nixEnd,
            outputData: nixPackageData,
            confidenceAfter: nixPackageData.confidence,
            dataChanges: ['packaging_from_nix']
          }
        );

        combinedContent += `\n[SOURCE: NIX.RU - EXCLUSIVE PRIMARY]\n`;
        combinedContent += `URL: ${nixPackageData.source_url}\n`;
        combinedContent += `DATA: ${JSON.stringify({
          width_mm: nixPackageData.width_mm,
          height_mm: nixPackageData.height_mm,
          depth_mm: nixPackageData.depth_mm,
          weight_g: nixPackageData.weight_g,
          mpn: nixPackageData.mpn,
          confidence: nixPackageData.confidence
        })}\n`;
        combinedContent += `RAW_SOURCE: ${nixPackageData.raw_source_string}\n`;
        
        evidenceSources.push(createEvidenceSource(
          nixPackageData.source_url,
          'nix_ru',
          ['logistics', 'package_dimensions', 'weight', 'mpn'],
          { 
            logistics: nixPackageData.raw_source_string,
            package_dimensions: `${nixPackageData.width_mm}×${nixPackageData.height_mm}×${nixPackageData.depth_mm}mm`,
            weight: `${nixPackageData.weight_g}g`,
            mpn: nixPackageData.mpn || 'N/A'
          },
          {
            confidence: nixPackageData.confidence,
            extractionMethod: 'nix_service_primary',
            processingDurationMs: nixEnd.getTime() - nixStart.getTime(),
            retryCount: 0,
            validationStatus: 'validated',
            qualityScore: nixPackageData.confidence
          }
        ));

        auditTrail.push(createAuditTrailEntry(
          'data_extraction',
          'nixService.fetchNIXPackageDataWithRetry',
          `Successfully extracted package data from NIX.ru with confidence ${nixPackageData.confidence}`,
          {
            sourceUrls: [nixPackageData.source_url],
            confidenceImpact: nixPackageData.confidence,
            dataFieldsAffected: ['packaging_from_nix'],
            processingTimeMs: nixEnd.getTime() - nixStart.getTime()
          }
        ));
      } else {
        console.warn('NIX.ru primary service failed, initiating Firecrawl agent fallback...');
        throw new Error('NIX.ru primary service unavailable, triggering Firecrawl fallback');
      }
    } catch (nixError) {
      const nixEnd = new Date();
      processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
        'scraping_nix',
        'failed',
        {
          startTime: nixStart,
          endTime: nixEnd,
          errorMessage: (nixError as Error).message,
          dataChanges: []
        }
      );

      auditTrail.push(createAuditTrailEntry(
        'error_handling',
        'nixService.fetchNIXPackageDataWithRetry',
        `NIX.ru primary service failed: ${(nixError as Error).message}. Initiating Firecrawl fallback.`,
        {
          dataFieldsAffected: ['packaging_from_nix'],
          processingTimeMs: nixEnd.getTime() - nixStart.getTime()
        }
      ));

      console.error('NIX.ru primary service error, using Firecrawl agent fallback:', nixError);
      
      // ENHANCED FALLBACK: Use Firecrawl Agent for comprehensive research
      const agentStart = new Date();
      processingHistory.push(createProcessingHistoryEntry('searching', 'started', { startTime: agentStart }));
      onProgress('searching'); // Update progress to show we're doing deep research
      
      try {
        console.log('Initiating enhanced Firecrawl agent research with reliable sources...');
        firecrawlAgentData = await deepAgentResearch(
          processedTitle, 
          textProcessingResult.brand.brand
        );
        
        const agentEnd = new Date();
        
        if (firecrawlAgentData) {
          processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
            'searching',
            'completed',
            {
              startTime: agentStart,
              endTime: agentEnd,
              outputData: firecrawlAgentData,
              confidenceAfter: firecrawlAgentData.research_quality?.confidence_score || 0.7,
              dataChanges: ['nix_logistics', 'compatibility_data', 'research_quality']
            }
          );

          combinedContent += `\n[SOURCE: FIRECRAWL AGENT - ENHANCED FALLBACK]\n`;
          combinedContent += `RESEARCH_QUALITY: ${JSON.stringify(firecrawlAgentData.research_quality || {})}\n`;
          
          // Process NIX.ru data from Firecrawl if available
          if (firecrawlAgentData.nix_logistics) {
            const nixData = firecrawlAgentData.nix_logistics;
            combinedContent += `NIX_LOGISTICS: ${JSON.stringify(nixData)}\n`;
            
            // Create compatible NIXPackageData structure
            nixPackageData = {
              width_mm: nixData.dimensions_mm?.width || null,
              height_mm: nixData.dimensions_mm?.height || null,
              depth_mm: nixData.dimensions_mm?.length || null,
              weight_g: nixData.weight_g || null,
              mpn: firecrawlAgentData.mpn || null,
              source_url: nixData.source_url || 'https://nix.ru',
              raw_source_string: nixData.raw_data || 'Firecrawl agent extraction',
              extraction_timestamp: new Date().toISOString(),
              confidence: firecrawlAgentData.research_quality?.confidence_score || 0.7
            };
            
            evidenceSources.push(createEvidenceSource(
              nixData.source_url || 'https://nix.ru',
              'nix_ru',
              ['logistics', 'package_dimensions', 'weight', 'mpn'],
              { 
                logistics: nixData.raw_data || 'Firecrawl agent extraction',
                package_dimensions: `${nixData.dimensions_mm?.width}×${nixData.dimensions_mm?.height}×${nixData.dimensions_mm?.length}mm`,
                weight: `${nixData.weight_g}g`,
                mpn: firecrawlAgentData.mpn || 'N/A'
              },
              {
                confidence: firecrawlAgentData.research_quality?.confidence_score || 0.7,
                extractionMethod: 'firecrawl_agent_fallback',
                processingDurationMs: agentEnd.getTime() - agentStart.getTime(),
                retryCount: 1,
                validationStatus: 'pending',
                qualityScore: firecrawlAgentData.research_quality?.confidence_score || 0.7
              }
            ));

            auditTrail.push(createAuditTrailEntry(
              'data_extraction',
              'firecrawlService.deepAgentResearch',
              `Firecrawl agent successfully extracted NIX.ru data as fallback with confidence ${firecrawlAgentData.research_quality?.confidence_score || 0.7}`,
              {
                sourceUrls: [nixData.source_url || 'https://nix.ru'],
                confidenceImpact: firecrawlAgentData.research_quality?.confidence_score || 0.7,
                dataFieldsAffected: ['packaging_from_nix'],
                processingTimeMs: agentEnd.getTime() - agentStart.getTime()
              }
            ));
          }
          
          // Process compatibility data from Firecrawl
          if (firecrawlAgentData.compatibility) {
            combinedContent += `COMPATIBILITY_DATA: ${JSON.stringify(firecrawlAgentData.compatibility)}\n`;
            
            // Add compatibility sources
            if (firecrawlAgentData.compatibility.sources) {
              firecrawlAgentData.compatibility.sources.forEach((source: any) => {
                evidenceSources.push(createEvidenceSource(
                  source.url,
                  source.source_type,
                  ['compatibility'],
                  { 
                    compatibility: `Printers: ${source.printers_confirmed?.join(', ') || 'N/A'}`
                  },
                  {
                    confidence: 0.8,
                    extractionMethod: 'firecrawl_agent',
                    processingDurationMs: agentEnd.getTime() - agentStart.getTime(),
                    retryCount: 0,
                    validationStatus: 'pending',
                    qualityScore: 0.8
                  }
                ));
              });

              auditTrail.push(createAuditTrailEntry(
                'data_extraction',
                'firecrawlService.deepAgentResearch',
                `Extracted compatibility data from ${firecrawlAgentData.compatibility.sources.length} sources`,
                {
                  sourceUrls: firecrawlAgentData.compatibility.sources.map((s: any) => s.url),
                  confidenceImpact: 0.8,
                  dataFieldsAffected: ['compatibility'],
                  processingTimeMs: agentEnd.getTime() - agentStart.getTime()
                }
              ));
            }
          }
          
          combinedContent += `FULL_AGENT_DATA: ${JSON.stringify(firecrawlAgentData)}\n`;
        } else {
          throw new Error('Firecrawl agent returned no data');
        }
      } catch (agentError) {
        const agentEnd = new Date();
        processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
          'searching',
          'failed',
          {
            startTime: agentStart,
            endTime: agentEnd,
            errorMessage: (agentError as Error).message,
            dataChanges: []
          }
        );

        console.error('Firecrawl agent fallback also failed:', agentError);
        combinedContent += `\n[FALLBACK FAILURE]\n`;
        combinedContent += `NIX_ERROR: ${nixError}\n`;
        combinedContent += `AGENT_ERROR: ${agentError}\n`;
        
        evidenceSources.push(createEvidenceSource(
          'https://nix.ru',
          'nix_ru',
          ['logistics_unavailable'],
          { 
            error: `Primary NIX service failed: ${nixError}. Firecrawl fallback failed: ${agentError}`
          },
          {
            confidence: 0.0,
            extractionMethod: 'failed_fallback',
            processingDurationMs: agentEnd.getTime() - agentStart.getTime(),
            retryCount: 2,
            validationStatus: 'failed',
            qualityScore: 0.0
          }
        ));

        auditTrail.push(createAuditTrailEntry(
          'error_handling',
          'firecrawlService.deepAgentResearch',
          `Both NIX.ru primary and Firecrawl agent fallback failed. NIX: ${nixError}. Agent: ${agentError}`,
          {
            dataFieldsAffected: ['packaging_from_nix'],
            processingTimeMs: agentEnd.getTime() - agentStart.getTime()
          }
        ));
      }
    }
    
    // Legacy NIX URL scraping as final fallback (only if both primary and agent failed)
    if (!nixPackageData) {
      const nixUrl = urls.find(u => u.includes('nix.ru'));
      if (nixUrl) {
        console.warn('Using legacy NIX.ru scraping as final fallback');
        const legacyStart = new Date();
        processingHistory.push(createProcessingHistoryEntry('scraping_nix', 'started', { startTime: legacyStart }));
        
        try {
          const nixRes = await firecrawlScrape(
            nixUrl, 
            "Extract technical logistics data for this printer part.",
            LOGISTICS_EXTRACT_SCHEMA
          );
          
          const legacyEnd = new Date();
          
          if (nixRes.success) {
            processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
              'scraping_nix',
              'completed',
              {
                startTime: legacyStart,
                endTime: legacyEnd,
                outputData: nixRes.data,
                confidenceAfter: 0.5,
                dataChanges: ['packaging_from_nix']
              }
            );

            combinedContent += `\n[SOURCE: NIX.RU - LEGACY FINAL FALLBACK]\nDATA: ${JSON.stringify(nixRes.data.json || nixRes.data.markdown)}`;
            
            evidenceSources.push(createEvidenceSource(
              nixUrl,
              'nix_ru',
              ['logistics', 'mpn'],
              { logistics: JSON.stringify(nixRes.data.json || {}) },
              {
                confidence: 0.5,
                extractionMethod: 'legacy_scraping',
                processingDurationMs: legacyEnd.getTime() - legacyStart.getTime(),
                retryCount: 3,
                validationStatus: 'pending',
                qualityScore: 0.5
              }
            ));

            auditTrail.push(createAuditTrailEntry(
              'data_extraction',
              'firecrawlService.firecrawlScrape',
              `Legacy NIX.ru scraping succeeded as final fallback`,
              {
                sourceUrls: [nixUrl],
                confidenceImpact: 0.5,
                dataFieldsAffected: ['packaging_from_nix'],
                processingTimeMs: legacyEnd.getTime() - legacyStart.getTime()
              }
            ));
          }
        } catch (legacyError) {
          const legacyEnd = new Date();
          processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
            'scraping_nix',
            'failed',
            {
              startTime: legacyStart,
              endTime: legacyEnd,
              errorMessage: (legacyError as Error).message,
              dataChanges: []
            }
          );

          console.error('Legacy NIX.ru scraping also failed:', legacyError);
          
          auditTrail.push(createAuditTrailEntry(
            'error_handling',
            'firecrawlService.firecrawlScrape',
            `All NIX.ru extraction methods failed. Legacy error: ${(legacyError as Error).message}`,
            {
              sourceUrls: [nixUrl],
              dataFieldsAffected: ['packaging_from_nix'],
              processingTimeMs: legacyEnd.getTime() - legacyStart.getTime()
            }
          ));
        }
      }
    }

    // Step 3: Data Synthesis
    const synthesisStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('analyzing', 'started', { startTime: synthesisStart }));
    onProgress('analyzing');
    
    const { data, thinking } = await synthesizeConsumableData(combinedContent, processedTitle, firecrawlAgentData);

    const synthesisEnd = new Date();
    processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
      'analyzing',
      'completed',
      {
        startTime: synthesisStart,
        endTime: synthesisEnd,
        inputData: { combinedContent, processedTitle, firecrawlAgentData },
        outputData: data,
        confidenceAfter: 0.8, // Will be calculated properly later
        dataChanges: ['all_consumable_data']
      }
    );

    auditTrail.push(createAuditTrailEntry(
      'transformation',
      'geminiService.synthesizeConsumableData',
      `Synthesized consumable data from ${evidenceSources.length} sources`,
      {
        confidenceImpact: 0.8,
        dataFieldsAffected: ['brand', 'model', 'consumable_type', 'printers_ru', 'packaging_from_nix', 'related_consumables'],
        processingTimeMs: synthesisEnd.getTime() - synthesisStart.getTime()
      }
    ));

    // Step 3.5: Enhanced Russian Market Filtering
    const russianFilterStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('analyzing', 'started', { startTime: russianFilterStart }));
    
    let enhancedCompatibilityData = data;
    
    // Convert legacy printers_ru array to PrinterCompatibility objects if needed
    if (data.printers_ru && data.printers_ru.length > 0) {
      const printerCompatibilityObjects = data.printers_ru.map(printerModel => ({
        model: printerModel,
        canonicalName: printerModel,
        sources: evidenceSources.map(source => ({
          url: source.url,
          timestamp: new Date(source.extracted_at),
          dataConfirmed: source.claims,
          confidence: source.confidence,
          sourceType: source.source_type,
          extractionMethod: source.extraction_method,
          rawData: source.evidence_snippets_by_claim ? JSON.stringify(source.evidence_snippets_by_claim) : undefined,
          processingDuration: source.processing_duration_ms,
          retryCount: source.retry_count || 0
        })),
        ruMarketEligibility: 'ru_unknown' as const,
        compatibilityConflict: false
      }));

      // Apply Russian market filtering with strict 2+ source verification
      const filterConfig = getRussianMarketFilterConfig('STANDARD'); // Use configurable profile

      const filterResult = filterPrintersForRussianMarket(printerCompatibilityObjects, filterConfig);
      
      // Update the data with filtered results
      enhancedCompatibilityData = {
        ...data,
        compatible_printers_all: printerCompatibilityObjects,
        compatible_printers_ru: filterResult.ruVerified,
        compatible_printers_unverified: [...filterResult.ruUnknown, ...filterResult.ruRejected],
        // Keep legacy printers_ru for backward compatibility, but only with verified printers
        printers_ru: filterResult.ruVerified.map(p => p.model)
      };

      // Add Russian market filtering audit trail
      auditTrail.push(...filterResult.auditTrail);
      
      const russianFilterEnd = new Date();
      processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
        'analyzing',
        'completed',
        {
          startTime: russianFilterStart,
          endTime: russianFilterEnd,
          inputData: printerCompatibilityObjects,
          outputData: filterResult,
          confidenceAfter: filterResult.qualityMetrics.averageConfidence,
          dataChanges: ['compatible_printers_ru', 'compatible_printers_unverified', 'ru_market_eligibility']
        }
      );

      auditTrail.push(createAuditTrailEntry(
        'validation',
        'russianMarketFilter.filterPrintersForRussianMarket',
        `Russian market filtering completed: ${filterResult.ruVerified.length} verified, ${filterResult.ruUnknown.length} unknown, ${filterResult.ruRejected.length} rejected`,
        {
          confidenceImpact: filterResult.qualityMetrics.averageConfidence,
          dataFieldsAffected: ['compatible_printers_ru', 'compatible_printers_unverified', 'ru_market_eligibility'],
          processingTimeMs: russianFilterEnd.getTime() - russianFilterStart.getTime()
        }
      ));
    }

    // Enhanced image validation step
    const imageValidationStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('auditing_images', 'started', { startTime: imageValidationStart }));
    onProgress('auditing_images');
    
    let validatedImages: ImageCandidate[] = [];
    
    if (data.images && data.images.length > 0) {
      // Validate each image using the enhanced validation system
      for (const image of data.images) {
        try {
          const validationResult = await validateProductImage(image.url, data.model || 'Unknown');
          const validatedImage = createImageCandidate(image.url, validationResult, image.width, image.height);
          validatedImages.push(validatedImage);
        } catch (error) {
          console.error('Image validation error:', error);
          // Keep original image with failed validation
          validatedImages.push({
            ...image,
            passes_rules: false,
            reject_reasons: [`Validation failed: ${error}`]
          });
        }
      }
    } else {
      // No images provided - create placeholder and validate it
      const placeholderUrl = `https://placehold.co/800x800/white/4338ca?text=${encodeURIComponent(data.model || 'Item')}`;
      const validationResult = await validateProductImage(placeholderUrl, data.model || 'Unknown');
      const placeholderImage = createImageCandidate(placeholderUrl, validationResult);
      validatedImages.push(placeholderImage);
    }

    const imageValidationEnd = new Date();
    processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
      'auditing_images',
      'completed',
      {
        startTime: imageValidationStart,
        endTime: imageValidationEnd,
        inputData: data.images,
        outputData: validatedImages,
        confidenceAfter: validatedImages.filter(img => img.passes_rules).length / validatedImages.length,
        dataChanges: ['images']
      }
    );

    auditTrail.push(createAuditTrailEntry(
      'validation',
      'imageValidationService.validateProductImage',
      `Validated ${validatedImages.length} images, ${validatedImages.filter(img => img.passes_rules).length} passed validation`,
      {
        confidenceImpact: validatedImages.filter(img => img.passes_rules).length / validatedImages.length,
        dataFieldsAffected: ['images'],
        processingTimeMs: imageValidationEnd.getTime() - imageValidationStart.getTime()
      }
    ));

    // Step 3.7: Enhanced Related Products Discovery
    const relatedProductsStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('analyzing', 'started', { startTime: relatedProductsStart }));
    
    let relatedProductsResult = null;
    
    // Only discover related products if we have compatible printers
    if (enhancedCompatibilityData.compatible_printers_ru && enhancedCompatibilityData.compatible_printers_ru.length > 0) {
      try {
        relatedProductsResult = await discoverRelatedProducts(
          enhancedCompatibilityData,
          enhancedCompatibilityData.compatible_printers_ru
        );
        
        const relatedProductsEnd = new Date();
        processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
          'analyzing',
          'completed',
          {
            startTime: relatedProductsStart,
            endTime: relatedProductsEnd,
            inputData: { compatiblePrinters: enhancedCompatibilityData.compatible_printers_ru.length },
            outputData: {
              totalFound: relatedProductsResult.metadata.totalFound,
              displayItems: relatedProductsResult.display.length,
              qualityScore: relatedProductsResult.metadata.qualityScore
            },
            confidenceAfter: relatedProductsResult.metadata.qualityScore,
            dataChanges: ['related_consumables_full', 'related_consumables_display', 'related_consumables_categories']
          }
        );

        auditTrail.push(createAuditTrailEntry(
          'enrichment',
          'relatedProductsService.discoverRelatedProducts',
          `Discovered ${relatedProductsResult.metadata.totalFound} related products, ${relatedProductsResult.display.length} selected for display`,
          {
            confidenceImpact: relatedProductsResult.metadata.qualityScore,
            dataFieldsAffected: ['related_consumables_full', 'related_consumables_display', 'related_consumables_categories'],
            processingTimeMs: relatedProductsEnd.getTime() - relatedProductsStart.getTime()
          }
        ));
      } catch (relatedError) {
        const relatedProductsEnd = new Date();
        processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
          'analyzing',
          'failed',
          {
            startTime: relatedProductsStart,
            endTime: relatedProductsEnd,
            errorMessage: (relatedError as Error).message,
            dataChanges: []
          }
        );

        console.warn('Related products discovery failed:', relatedError);
        
        auditTrail.push(createAuditTrailEntry(
          'error_handling',
          'relatedProductsService.discoverRelatedProducts',
          `Related products discovery failed: ${(relatedError as Error).message}`,
          {
            dataFieldsAffected: ['related_consumables'],
            processingTimeMs: relatedProductsEnd.getTime() - relatedProductsStart.getTime()
          }
        ));
      }
    } else {
      const relatedProductsEnd = new Date();
      processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
        'analyzing',
        'skipped',
        {
          startTime: relatedProductsStart,
          endTime: relatedProductsEnd,
          errorMessage: 'No compatible printers available for related products discovery',
          dataChanges: []
        }
      );

      auditTrail.push(createAuditTrailEntry(
        'enrichment',
        'relatedProductsService.discoverRelatedProducts',
        'Related products discovery skipped - no compatible printers available',
        {
          dataFieldsAffected: ['related_consumables'],
          processingTimeMs: relatedProductsEnd.getTime() - relatedProductsStart.getTime()
        }
      ));
    }

    // Enhance the data with text processing results and NIX data
    const enhancedData: ConsumableData = {
      ...enhancedCompatibilityData, // Use the Russian market filtered data instead of raw data
      // Override with text processing results if they have higher confidence
      model: textProcessingResult.model.confidence > 0.8 ? textProcessingResult.model.model : enhancedCompatibilityData.model,
      brand: textProcessingResult.brand.confidence > 0.8 ? textProcessingResult.brand.brand : enhancedCompatibilityData.brand,
      // Add yield information if extracted
      yield: textProcessingResult.yieldInfo.length > 0 ? {
        value: textProcessingResult.yieldInfo[0].value,
        unit: textProcessingResult.yieldInfo[0].unit,
        coverage_percent: 5 // Default assumption
      } : enhancedCompatibilityData.yield,
      // Enhanced packaging data from NIX service
      packaging_from_nix: nixPackageData ? {
        width_mm: nixPackageData.width_mm,
        height_mm: nixPackageData.height_mm,
        depth_mm: nixPackageData.depth_mm,
        weight_g: nixPackageData.weight_g,
        raw_source_string: nixPackageData.raw_source_string,
        confidence: nixPackageData.confidence,
        extraction_timestamp: nixPackageData.extraction_timestamp,
        source_url: nixPackageData.source_url
      } : enhancedCompatibilityData.packaging_from_nix,
      // Use validated images
      images: validatedImages,
      // Enhanced related products data
      related_consumables: relatedProductsResult ? 
        relatedProductsResult.display.map(item => ({
          model: item.model,
          type: item.type,
          relationship: item.relationship
        })) : enhancedCompatibilityData.related_consumables,
      related_consumables_full: relatedProductsResult?.full,
      related_consumables_display: relatedProductsResult?.display,
      related_consumables_categories: relatedProductsResult?.categories,
      // Add normalization log
      normalization_log: textProcessingResult.normalizationLog.map(log => 
        `${log.step}: ${log.description} (${log.before} → ${log.after})`
      )
    };

    // Step 4: Enhanced Final Validation and Error Checking with Structured Error Details
    const validationStart = new Date();
    processingHistory.push(createProcessingHistoryEntry('finalizing', 'started', { startTime: validationStart }));
    onProgress('finalizing');
    
    const errors: string[] = [];
    const errorDetails: ErrorDetail[] = [];
    const failureReasons: FailureReason[] = [];
    
    // Enhanced NIX.ru validation with Firecrawl fallback consideration
    if (!enhancedData.packaging_from_nix?.weight_g || !enhancedData.packaging_from_nix?.width_mm || 
        !enhancedData.packaging_from_nix?.height_mm || !enhancedData.packaging_from_nix?.depth_mm) {
      
      // Check if Firecrawl agent provided NIX data as fallback
      if (firecrawlAgentData?.nix_logistics && 
          firecrawlAgentData.nix_logistics.weight_g && 
          firecrawlAgentData.nix_logistics.dimensions_mm) {
        console.log('Using Firecrawl agent NIX.ru data as fallback');
        const errorDetail = createErrorDetail(
          'nix_data_from_fallback',
          'Package data obtained via Firecrawl agent fallback instead of primary NIX.ru service',
          { 
            firecrawlConfidence: firecrawlAgentData.research_quality?.confidence_score,
            nixUrl: firecrawlAgentData.nix_logistics.source_url 
          },
          'scraping_nix',
          'Primary NIX.ru service failed, used Firecrawl agent as fallback'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('nix_data_from_fallback');
        errors.push("nix_data_from_fallback: Package data obtained via Firecrawl agent fallback");
      } else {
        const errorDetail = createErrorDetail(
          'missing_nix_dimensions_weight',
          'Complete package data missing from NIX.ru and fallback failed',
          { 
            missingFields: ['weight_g', 'width_mm', 'height_mm', 'depth_mm'].filter(field => 
              !enhancedData.packaging_from_nix?.[field as keyof typeof enhancedData.packaging_from_nix]
            )
          },
          'scraping_nix',
          'Both primary NIX.ru service and Firecrawl agent fallback failed to provide package data'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('missing_nix_dimensions_weight');
        errors.push("missing_nix_dimensions_weight: Complete package data missing from NIX.ru and fallback failed");
      }
    }
    
    // Validate NIX data quality if present
    if (nixPackageData && nixPackageData.confidence < 0.5) {
      const errorDetail = createErrorDetail(
        'low_confidence_nix_data',
        `NIX.ru data has low confidence score: ${nixPackageData.confidence}`,
        { 
          confidence: nixPackageData.confidence,
          sourceUrl: nixPackageData.source_url,
          extractionMethod: 'nix_service_primary'
        },
        'scraping_nix',
        'NIX.ru data extraction confidence below acceptable threshold'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('low_confidence_nix_data');
      errors.push("low_confidence_nix_data: NIX.ru data has low confidence score");
    }
    
    // Enhanced Firecrawl agent data quality validation
    if (firecrawlAgentData?.research_quality) {
      const quality = firecrawlAgentData.research_quality;
      if (quality.confidence_score < 0.6) {
        const errorDetail = createErrorDetail(
          'low_confidence_agent_research',
          `Firecrawl agent research has low confidence score: ${quality.confidence_score}`,
          { 
            confidence: quality.confidence_score,
            oemSources: quality.oem_sources_found,
            ruSources: quality.ru_sources_found
          },
          'searching',
          'Firecrawl agent research confidence below acceptable threshold'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('low_confidence_agent_research');
        errors.push("low_confidence_agent_research: Firecrawl agent research has low confidence score");
      }
      if (quality.oem_sources_found === 0) {
        const errorDetail = createErrorDetail(
          'no_oem_sources',
          'No OEM sources found during research',
          { 
            oemSources: quality.oem_sources_found,
            ruSources: quality.ru_sources_found,
            totalSources: quality.ru_sources_found
          },
          'searching',
          'Research failed to locate official manufacturer sources'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('no_oem_sources');
        errors.push("no_oem_sources: No OEM sources found during research");
      }
      if (quality.ru_sources_found < 2 && !quality.oem_sources_found) {
        const errorDetail = createErrorDetail(
          'insufficient_ru_verification',
          `Less than 2 Russian sources found for verification: ${quality.ru_sources_found}`,
          { 
            ruSources: quality.ru_sources_found,
            oemSources: quality.oem_sources_found,
            requiredSources: 2
          },
          'analyzing',
          'Insufficient Russian market sources for printer compatibility verification'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('insufficient_ru_verification');
        errors.push("insufficient_ru_verification: Less than 2 Russian sources found for verification");
      }
    }
    
    // Validate unit conversion accuracy
    if (enhancedData.packaging_from_nix) {
      const pkg = enhancedData.packaging_from_nix;
      if (pkg.width_mm && (pkg.width_mm < 10 || pkg.width_mm > 1000)) {
        const errorDetail = createErrorDetail(
          'invalid_dimensions',
          `Package dimensions outside reasonable range: ${pkg.width_mm}mm width`,
          { 
            width: pkg.width_mm,
            height: pkg.height_mm,
            depth: pkg.depth_mm,
            reasonableRange: '10-1000mm'
          },
          'analyzing',
          'Package dimensions appear to be incorrectly converted or extracted'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('invalid_dimensions');
        errors.push("invalid_dimensions: Package dimensions outside reasonable range");
      }
      if (pkg.weight_g && (pkg.weight_g < 10 || pkg.weight_g > 10000)) {
        const errorDetail = createErrorDetail(
          'invalid_weight',
          `Package weight outside reasonable range: ${pkg.weight_g}g`,
          { 
            weight: pkg.weight_g,
            reasonableRange: '10-10000g'
          },
          'analyzing',
          'Package weight appears to be incorrectly converted or extracted'
        );
        errorDetails.push(errorDetail);
        failureReasons.push('invalid_weight');
        errors.push("invalid_weight: Package weight outside reasonable range");
      }
    }
    
    // Enhanced image validation errors
    const validImages = validatedImages.filter(img => img.passes_rules);
    if (validImages.length === 0) {
      const errorDetail = createErrorDetail(
        'missing_valid_image',
        'No images meeting quality standards (800x800px, white background, no watermarks)',
        { 
          totalImages: validatedImages.length,
          validImages: validImages.length,
          rejectionReasons: validatedImages.flatMap(img => img.reject_reasons)
        },
        'auditing_images',
        'All provided images failed validation criteria'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('missing_valid_image');
      errors.push("missing_valid_image: No images meeting quality standards (800x800px, white background, no watermarks)");
    }
    
    // Check for specific image validation failures
    const imageIssues = validatedImages.flatMap(img => img.reject_reasons);
    if (imageIssues.length > 0) {
      const uniqueIssues = [...new Set(imageIssues)];
      const errorDetail = createErrorDetail(
        'image_validation_issues',
        `Image validation issues: ${uniqueIssues.join('; ')}`,
        { 
          issues: uniqueIssues,
          totalImages: validatedImages.length,
          failedImages: validatedImages.filter(img => !img.passes_rules).length
        },
        'auditing_images',
        'Specific image validation criteria failed'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('image_validation_issues');
      errors.push(`image_validation_issues: ${uniqueIssues.join('; ')}`);
    }
    
    // Enhanced compatibility validation with Russian market filtering
    if (enhancedData.compatible_printers_ru && enhancedData.compatible_printers_ru.length === 0 && 
        enhancedData.compatible_printers_unverified && enhancedData.compatible_printers_unverified.length > 0) {
      const errorDetail = createErrorDetail(
        'ru_eligibility_unknown',
        'Printers found but not verified for Russian market (less than 2 Russian sources)',
        { 
          unverifiedPrinters: enhancedData.compatible_printers_unverified.length,
          verifiedPrinters: enhancedData.compatible_printers_ru.length,
          requiredSources: 2
        },
        'analyzing',
        'Russian market eligibility could not be established for discovered printers'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('ru_eligibility_unknown');
      errors.push("ru_eligibility_unknown: Printers found but not verified for Russian market (less than 2 Russian sources)");
    }
    
    // Check for compatibility conflicts
    const conflictedPrinters = enhancedData.compatible_printers_all?.filter(p => p.compatibilityConflict) || [];
    if (conflictedPrinters.length > 0) {
      const errorDetail = createErrorDetail(
        'compatibility_conflict',
        `${conflictedPrinters.length} printers have conflicting compatibility data`,
        { 
          conflictedPrinters: conflictedPrinters.map(p => p.model),
          totalPrinters: enhancedData.compatible_printers_all?.length || 0
        },
        'analyzing',
        'Multiple sources provided contradictory printer compatibility information'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('compatibility_conflict');
      errors.push(`compatibility_conflict: ${conflictedPrinters.length} printers have conflicting compatibility data`);
    }
    
    // Basic field validation with structured errors
    if (enhancedData.printers_ru.length === 0) {
      const errorDetail = createErrorDetail(
        'failed_parse_model',
        'No compatible printer models found',
        { 
          inputTitle: inputRaw,
          extractedModel: enhancedData.model,
          extractedBrand: enhancedData.brand
        },
        'analyzing',
        'Failed to identify any compatible printer models from research'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('failed_parse_model');
      errors.push("No compatible printer models found.");
    }
    
    if (!enhancedData.model) {
      const errorDetail = createErrorDetail(
        'failed_parse_model',
        'Could not extract consumable model from title',
        { 
          inputTitle: inputRaw,
          textProcessingResult: textProcessingResult.model
        },
        'idle',
        'Text processing and research failed to identify consumable model'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('failed_parse_model');
      errors.push("Could not extract consumable model from title.");
    }
    
    if (!enhancedData.brand) {
      const errorDetail = createErrorDetail(
        'failed_parse_brand',
        'Could not determine printer brand',
        { 
          inputTitle: inputRaw,
          textProcessingResult: textProcessingResult.brand
        },
        'idle',
        'Text processing and research failed to identify printer brand'
      );
      errorDetails.push(errorDetail);
      failureReasons.push('failed_parse_brand');
      errors.push("Could not determine printer brand.");
    }

    const validationEnd = new Date();
    const finalStatus = errors.length > 0 ? 'needs_review' : 'ok';
    
    processingHistory[processingHistory.length - 1] = createProcessingHistoryEntry(
      'finalizing',
      'completed',
      {
        startTime: validationStart,
        endTime: validationEnd,
        inputData: enhancedData,
        outputData: { status: finalStatus, errors },
        confidenceAfter: errors.length === 0 ? 0.9 : 0.6,
        dataChanges: ['validation_errors', 'status']
      }
    );

    auditTrail.push(createAuditTrailEntry(
      'quality_check',
      'geminiService.processItem',
      `Final validation completed with ${errors.length} errors. Status: ${finalStatus}`,
      {
        confidenceImpact: errors.length === 0 ? 0.9 : 0.6,
        dataFieldsAffected: ['validation_errors', 'status'],
        processingTimeMs: validationEnd.getTime() - validationStart.getTime()
      }
    ));

    // Create the base enriched item with enhanced error handling
    const baseItem: EnrichedItem = {
      id: uuidv4(),
      input_raw: inputRaw,
      data: enhancedData,
      evidence: { 
        sources: evidenceSources, 
        grounding_metadata: urls.map(u => ({ title: 'Research Source', uri: u })),
        processing_history: [],
        quality_metrics: {
          data_completeness_score: 0,
          source_reliability_score: 0,
          validation_pass_rate: 0,
          processing_efficiency: 0,
          audit_completeness: 0,
          last_calculated: new Date().toISOString(),
          total_sources_used: 0,
          failed_validations: [],
          missing_required_fields: []
        },
        audit_trail: []
      },
      status: finalStatus as any,
      validation_errors: errors,
      // Enhanced error handling fields
      error_details: errorDetails,
      failure_reasons: failureReasons,
      retry_count: 0,
      is_retryable: errorDetails.some(error => error.retryable),
      thinking_process: thinking,
      created_at: Date.now(),
      updated_at: Date.now(),
      job_run_id: jobRunId,
      input_hash: inputHash,
      ruleset_version: RULESET_VERSION,
      parser_version: PARSER_VERSION,
      processed_at: new Date().toISOString(),
      processing_duration_ms: Date.now() - processingStartTime.getTime(),
      quality_score: 0 // Will be calculated in enhanceItemWithAuditTrail
    };

    // Enhance with comprehensive audit trail
    const finalItem = enhanceItemWithAuditTrail(baseItem, processingHistory, auditTrail);

    auditTrail.push(createAuditTrailEntry(
      'enrichment',
      'geminiService.processItem',
      `Processing completed successfully. Final quality score: ${finalItem.quality_score?.toFixed(3)}`,
      {
        inputHash,
        confidenceImpact: finalItem.quality_score || 0,
        dataFieldsAffected: ['all'],
        processingTimeMs: Date.now() - processingStartTime.getTime()
      }
    ));

    return finalItem;
  } catch (err) {
    console.error("Enrichment Process Failed:", err);
    throw err;
  }
};

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
