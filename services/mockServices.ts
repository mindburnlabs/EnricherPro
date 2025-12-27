/**
 * Mock Services for Testing and Development
 * Provides fallback implementations when external APIs are unavailable
 */

import { EnrichedItem, ConsumableData, ValidationStatus, ProcessingStep } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface MockConfig {
  enableGeminiMock: boolean;
  enableFirecrawlMock: boolean;
  enableImageValidationMock: boolean;
  simulateApiErrors: boolean;
  responseDelay: number;
}

const DEFAULT_MOCK_CONFIG: MockConfig = {
  enableGeminiMock: true,
  enableFirecrawlMock: true,
  enableImageValidationMock: true,
  simulateApiErrors: false,
  responseDelay: 100
};

let mockConfig: MockConfig = { ...DEFAULT_MOCK_CONFIG };

export function setMockConfig(config: Partial<MockConfig>): void {
  mockConfig = { ...mockConfig, ...config };
}

export function getMockConfig(): MockConfig {
  return { ...mockConfig };
}

/**
 * Mock Gemini Service for testing
 */
export async function mockProcessItem(
  input: string,
  onStepUpdate?: (step: ProcessingStep) => void
): Promise<EnrichedItem> {
  if (onStepUpdate) onStepUpdate('idle');
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, mockConfig.responseDelay));
  
  if (onStepUpdate) onStepUpdate('searching');
  await new Promise(resolve => setTimeout(resolve, mockConfig.responseDelay));
  
  if (onStepUpdate) onStepUpdate('analyzing');
  await new Promise(resolve => setTimeout(resolve, mockConfig.responseDelay));

  // Parse the input to extract basic information
  const { model, brand, type, yield: yieldValue, color } = parseInputForMock(input);

  const mockItem: EnrichedItem = {
    id: uuidv4(),
    input_raw: input,
    data: {
      brand,
      consumable_type: type,
      model,
      short_model: model.replace(/^[A-Z]+/, ''),
      model_alias_short: model.replace(/^[A-Z]+/, ''),
      yield: yieldValue ? {
        value: yieldValue,
        unit: 'pages' as const,
        coverage_percent: 5
      } : null,
      color: color || null,
      has_chip: 'unknown' as const,
      has_page_counter: 'unknown' as const,
      printers_ru: [`${brand} Test Printer`],
      compatible_printers_ru: [{
        model: `${brand} Test Printer`,
        canonicalName: `${brand} Test Printer`,
        sources: [{
          url: 'https://cartridge.ru/test',
          timestamp: new Date(),
          dataConfirmed: ['compatibility'],
          confidence: 0.9,
          sourceType: 'compatibility_db',
          extractionMethod: 'web_scraping'
        }],
        ruMarketEligibility: 'ru_verified' as const,
        compatibilityConflict: false
      }],
      related_consumables: [],
      related_consumables_full: [],
      related_consumables_display: [],
      related_consumables_categories: {
        companions: [],
        alternatives: [],
        colorVariants: [],
        replacements: []
      },
      packaging_from_nix: {
        width_mm: 150,
        height_mm: 100,
        depth_mm: 50,
        weight_g: 800,
        confidence: 0.9
      },
      images: [{
        url: `https://placehold.co/800x800/white/4338ca?text=${encodeURIComponent(model)}`,
        width: 800,
        height: 800,
        white_bg_score: 0.9,
        is_packaging: false,
        has_watermark: false,
        has_oem_logo: false,
        passes_rules: true,
        reject_reasons: []
      }],
      faq: [],
      confidence: {
        model_name: 0.9,
        short_model: 0.85,
        logistics: 0.8,
        compatibility: 0.9,
        faq: 0.7,
        overall: 0.85,
        data_completeness: 0.9,
        source_reliability: 0.8
      }
    },
    evidence: {
      sources: [{
        url: 'https://nix.ru/mock-test',
        source_type: 'nix_ru',
        claims: ['package dimensions', 'model verification'],
        evidence_snippets_by_claim: {
          'package dimensions': 'Mock package data: 150x100x50mm, 800g',
          'model verification': `Mock model verification for ${model}`
        },
        extracted_at: new Date().toISOString(),
        confidence: 0.9,
        extraction_method: 'mock_api'
      }],
      processing_history: [{
        step: 'mock_processing',
        timestamp: new Date().toISOString(),
        duration_ms: mockConfig.responseDelay * 3,
        status: 'completed',
        details: 'Mock processing completed successfully'
      }],
      quality_metrics: {
        data_completeness_score: 0.9,
        source_reliability_score: 0.8,
        validation_pass_rate: 0.95,
        processing_efficiency: 0.85,
        audit_completeness: 0.9,
        last_calculated: new Date().toISOString(),
        total_sources_used: 3,
        failed_validations: [],
        missing_required_fields: []
      },
      audit_trail: [{
        action: 'mock_enrichment',
        timestamp: new Date().toISOString(),
        user_id: 'mock_system',
        details: 'Mock enrichment process completed',
        changes: ['Added mock package data', 'Added mock compatibility data']
      }]
    },
    status: 'ok' as ValidationStatus,
    validation_errors: [],
    error_details: [],
    failure_reasons: [],
    retry_count: 0,
    is_retryable: false,
    created_at: Date.now(),
    updated_at: Date.now(),
    job_run_id: `mock-job-${Date.now()}`,
    input_hash: `mock-hash-${input.length}`,
    ruleset_version: '2.1.0',
    parser_version: '1.5.0',
    processed_at: new Date().toISOString()
  };

  if (onStepUpdate) onStepUpdate('idle');
  return mockItem;
}

/**
 * Parse input string to extract mock data
 */
function parseInputForMock(input: string): {
  model: string;
  brand: string;
  type: 'toner_cartridge' | 'drum_unit' | 'ink_cartridge';
  yield?: number;
  color?: string;
} {
  const inputLower = input.toLowerCase();
  
  // Extract model using simple patterns
  let model = '';
  const modelPatterns = [
    /\b([A-Z]{2}[-]\d{4,5})\b/g, // TN-1150, DR-3400
    /\b([A-Z]{3}[-]\d{3}[A-Z]?)\b/g, // CRG-045
    /\b([A-Z]{1,2}\d{3,5}[A-Z]?)\b/g, // CF234A
    /\b(\d{3}R\d{5})\b/g // 106R03623
  ];
  
  for (const pattern of modelPatterns) {
    const match = pattern.exec(input);
    if (match) {
      model = match[1];
      break;
    }
  }
  
  if (!model) {
    model = 'MOCK123'; // Fallback
  }

  // Extract brand
  let brand = '';
  if (/\bhp\b/i.test(input)) brand = 'HP';
  else if (/\bcanon\b/i.test(input)) brand = 'Canon';
  else if (/\bbrother\b/i.test(input)) brand = 'Brother';
  else if (/\bkyocera\b/i.test(input)) brand = 'Kyocera';
  else if (/\bepson\b/i.test(input)) brand = 'Epson';
  else if (/\bxerox\b/i.test(input)) brand = 'Xerox';
  else brand = 'Generic';

  // Extract type
  let type: 'toner_cartridge' | 'drum_unit' | 'ink_cartridge' = 'toner_cartridge';
  if (/drum/i.test(input)) type = 'drum_unit';
  else if (/ink/i.test(input)) type = 'ink_cartridge';

  // Extract yield
  let yieldValue: number | undefined;
  const yieldMatch = input.match(/(\d+(?:[.,]\d+)?)\s*[K\u041A]/i);
  if (yieldMatch) {
    const num = parseFloat(yieldMatch[1].replace(',', '.'));
    yieldValue = num * 1000;
  } else {
    const directYieldMatch = input.match(/(\d+)\s*(pages?|страниц)/i);
    if (directYieldMatch) {
      yieldValue = parseInt(directYieldMatch[1]);
    }
  }

  // Extract color
  let color: string | undefined;
  if (/cyan/i.test(input)) color = 'Cyan';
  else if (/magenta/i.test(input)) color = 'Magenta';
  else if (/yellow/i.test(input)) color = 'Yellow';
  else if (/black/i.test(input)) color = 'Black';

  return { model, brand, type, yield: yieldValue, color };
}

/**
 * Mock image validation service
 */
export async function mockValidateProductImage(
  imageUrl: string,
  expectedModel: string
): Promise<{
  isValid: boolean;
  confidence: number;
  rejectionReasons: string[];
  validationChecks: Array<{
    checkName: string;
    passed: boolean;
    confidence: number;
    details?: string;
  }>;
}> {
  await new Promise(resolve => setTimeout(resolve, mockConfig.responseDelay));

  const checks = [
    {
      checkName: 'resolution_check',
      passed: true,
      confidence: 0.95,
      details: 'Mock: Image resolution 800x800 meets minimum requirements'
    },
    {
      checkName: 'background_analysis',
      passed: true,
      confidence: 0.9,
      details: 'Mock: White background detected with 90% confidence'
    },
    {
      checkName: 'packaging_detection',
      passed: true,
      confidence: 0.85,
      details: 'Mock: No packaging detected in image'
    },
    {
      checkName: 'text_logo_detection',
      passed: true,
      confidence: 0.8,
      details: 'Mock: No unauthorized text or logos detected'
    },
    {
      checkName: 'watermark_detection',
      passed: true,
      confidence: 0.95,
      details: 'Mock: No watermarks detected'
    }
  ];

  return {
    isValid: true,
    confidence: 0.88,
    rejectionReasons: [],
    validationChecks: checks
  };
}

/**
 * Check if we should use mock services based on environment and errors
 */
export function shouldUseMockServices(): boolean {
  // Use mocks in test environment or when explicitly enabled
  return process.env.NODE_ENV === 'test' || 
         process.env.USE_MOCK_SERVICES === 'true' ||
         mockConfig.enableGeminiMock;
}

/**
 * Detect API quota/credential errors and enable mocks
 */
export function handleApiError(error: any): boolean {
  const errorMessage = error?.message || error?.toString() || '';
  
  // Check for quota exceeded errors
  if (errorMessage.includes('quota') || 
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED')) {
    console.warn('API quota exceeded, enabling mock services');
    setMockConfig({ enableGeminiMock: true });
    return true;
  }

  // Check for credential errors
  if (errorMessage.includes('credentials') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('unauthorized')) {
    console.warn('API credentials issue, enabling mock services');
    setMockConfig({ 
      enableGeminiMock: true, 
      enableImageValidationMock: true 
    });
    return true;
  }

  // Check for circuit breaker
  if (errorMessage.includes('Circuit breaker')) {
    console.warn('Circuit breaker open, enabling mock services');
    setMockConfig({ enableGeminiMock: true });
    return true;
  }

  return false;
}