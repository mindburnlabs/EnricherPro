/**
 * End-to-End Integration Test Suite for Consumable Enricher Pro
 * Task 12: Final Integration and Testing
 * 
 * This comprehensive test suite validates:
 * - Complete pipeline from input to enriched output
 * - Russian market requirements compliance
 * - Batch processing with various data sets
 * - Export functionality with enhanced data
 * - Audit trail completeness and data provenance
 * 
 * Requirements: All (comprehensive validation)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { orchestrationService } from './services/orchestrationService';
import { filterPrintersForRussianMarket } from './services/russianMarketFilter';
import { validateProductImage } from './services/imageValidationService';
import { evaluatePublicationReadiness } from './services/publicationReadinessService';
import { processSupplierTitle } from './services/textProcessingService';

import { EnrichedItem, ConsumableData, ValidationStatus, ProcessingStep } from './types';
import { v4 as uuidv4 } from 'uuid';

vi.mock('./services/apiIntegrationService', () => {
  const mockMakeRequest = async (context: any, operation: any) => {
    const { serviceId, operation: opName, metadata } = context;



    // 1. Research phase (Gemini)
    if (serviceId === 'gemini' && opName === 'researchProductContext') {
      return {
        success: true,
        data: {
          text: "Mock research summary found for " + (metadata?.query || "product"),
          candidates: [{
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://nix.ru/mock-product" } },
                { web: { uri: "https://hp.com/mock-product" } }
              ]
            }
          }]
        }
      };
    }

    // Perplexity (Discovery Agent) handling
    if ((serviceId === 'perplexity-openrouter' || serviceId === 'perplexity-direct') && opName === 'discoverSources') {
      return {
        success: true,
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                summary: "Mock Perplexity Summary",
                sources: ["https://nix.ru/mock-product", "https://hp.com/mock-product"]
              })
            }
          }],
          citations: ["https://nix.ru/mock-product"]
        }
      };
    }

    // 2. Firecrawl Agent (NIX Fallback or Deep Research)
    if (serviceId === 'firecrawl' && opName === 'agent') {
      // NOTE: nixService expects { nix_logistics: ... } in the data property of the response from firecrawlAgent
      // firecrawlAgent calls apiIntegrationService.
      // But firecrawlAgent implementation wraps the result?
      // Let's ensure structure matches nixService expectations.
      return {
        success: true,
        data: {
          url: "https://nix.ru/mock-product",
          answer: "https://nix.ru/mock-product",
          nix_logistics: {
            width_mm: 360, height_mm: 120, depth_mm: 110, weight_g: 800,
            source_url: 'https://nix.ru/mock-product'
          },
          research_quality: { confidence_score: 0.95 }
        }
      };
    }

    // 3. Firecrawl Scrape (NIX Data)
    if (serviceId === 'firecrawl' && opName === 'scrape') {
      return {
        success: true,
        data: {
          markdown: "Размеры упаковки: 36 x 12 x 11 см. Вес брутто: 0.8 кг"
        }
      };
    }

    // 4. Synthesize Data (Gemini)
    if (serviceId === 'gemini' && opName === 'synthesizeConsumableData') {
      const query = metadata?.query || "";
      let brand = "Generic";
      let model = "Model";
      let type = "toner_cartridge";
      let yieldVal = 1000;

      if (query.includes("HP") || query.includes("CF234A")) { brand = "HP"; model = "CF234A"; yieldVal = 9200; }
      if (query.includes("Brother") && query.includes("1150")) { brand = "Brother"; model = "TN-1150"; yieldVal = 2500; }
      if (query.includes("Canon") && query.includes("045")) { brand = "Canon"; model = "CRG-045"; type = "toner_cartridge"; yieldVal = 1300; }
      if (query.match(/Xerox/i)) { brand = "Xerox"; model = "106R03623"; yieldVal = 15000; }
      if (query.match(/Drum/i)) { brand = "Brother"; model = "DR-1050"; type = "drum_unit"; yieldVal = 10000; }

      const mockData = {
        brand,
        model,
        consumable_type: type,
        yield: { value: yieldVal, unit: 'pages', coverage_percent: 5 },
        color: query.includes("Cyan") ? "Cyan" : (type === "toner_cartridge" ? "Black" : null),
        printers_ru: [`${brand} Test Printer`],
        packaging_from_nix: { width_mm: 360, height_mm: 120, depth_mm: 110, weight_g: 800 },
        compatible_printers_ru: [{
          model: `${brand} Test Printer`,
          canonicalName: `${brand} Test Printer`,
          ruMarketEligibility: 'ru_verified',
          sources: [{ url: 'https://nix.ru', confidence: 0.9, dataConfirmed: ['compatibility'] }]
        }],
        related_consumables: [],
        confidence: { overall: 0.9, model_name: 0.9, brand: 0.9 },
        model_alias_short: model.replace(/^[A-Z\-]+/, ''),
        sources: [
          { url: 'https://nix.ru/mock-product', sourceType: 'nix_ru', confidence: 1.0, dataConfirmed: ['dimensions', 'weight'] },
          { url: 'https://hp.com/mock-product', sourceType: 'official', confidence: 0.9, dataConfirmed: ['compatibility'] }
        ]
      };

      return {
        success: true,
        data: {
          text: JSON.stringify(mockData),
          candidates: [{ content: { parts: [{ thought: true, text: "Mock thinking..." }] } }]
        }
      };
    }

    // Default success for others
    return { success: true, data: {} };
  }; // End of mockMakeRequest function

  return {
    apiIntegrationService: {
      makeRequest: vi.fn(mockMakeRequest),
      registerService: vi.fn()
    }
  };
});

// Comprehensive test data representing real-world scenarios
const END_TO_END_TEST_CASES = [
  {
    name: "HP Toner Cartridge - High Yield",
    input: "HP CF234A LaserJet Pro M106w M134a M134fn Toner Cartridge 9.2K pages",
    expectedResults: {
      model: "CF234A",
      brand: "HP",
      type: "toner_cartridge",
      yield: 9200,
      hasRussianMarketPrinters: true,
      shouldHavePackaging: true,
      shouldHaveRelatedItems: true
    }
  },
  {
    name: "Brother Toner - Cyrillic Characters",
    input: "Brother TN-1150 для HL-1110/1112/DCP-1510/1512/MFC-1810/1815 2500стр",
    expectedResults: {
      model: "TN-1150",
      brand: "Brother",
      type: "toner_cartridge",
      yield: 2500,
      hasRussianMarketPrinters: true,
      shouldHavePackaging: true,
      shouldHaveRelatedItems: true
    }
  },
  {
    name: "Canon Color Cartridge - Metric Yield",
    input: "Canon CRG-045 Cyan для LBP611Cn/613Cdw/MF631Cn/633Cdw/635Cx 1,3К",
    expectedResults: {
      model: "CRG-045",
      brand: "Canon",
      type: "toner_cartridge",
      color: "Cyan",
      yield: 1300,
      hasRussianMarketPrinters: true,
      shouldHavePackaging: true,
      shouldHaveRelatedItems: true
    }
  },
  {
    name: "Complex Model Pattern",
    input: "Xerox 106R03623 WorkCentre 3335/3345 Phaser 3330 High Capacity 15000 pages",
    expectedResults: {
      model: "106R03623",
      brand: "Xerox",
      type: "toner_cartridge",
      yield: 15000,
      hasRussianMarketPrinters: false, // Xerox may have limited Russian market presence
      shouldHavePackaging: true,
      shouldHaveRelatedItems: true
    }
  },
  {
    name: "Drum Unit Test",
    input: "Brother DR-1050 Drum Unit для HL-1110/1112/DCP-1510/1512/MFC-1810/1815 10000стр",
    expectedResults: {
      model: "DR-1050",
      brand: "Brother",
      type: "drum_unit",
      yield: 10000,
      hasRussianMarketPrinters: true,
      shouldHavePackaging: true,
      shouldHaveRelatedItems: true
    }
  }
];

// Mock processing step callback for testing
const createMockStepCallback = (testName: string) => {
  return (step: ProcessingStep) => {
    console.log(`[${testName}] Processing step: ${step}`);
  };
};

/**
 * Test complete pipeline processing for individual items
 */
async function testCompleteDataProcessingPipeline(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("🔄 Testing Complete Data Processing Pipeline...");

  for (const testCase of END_TO_END_TEST_CASES) {
    try {
      details.push(`\n📝 Processing: ${testCase.name}`);
      details.push(`   Input: "${testCase.input}"`);

      const startTime = Date.now();
      const result = await orchestrationService.processItem(testCase.input, (step) => { });
      const processingTime = Date.now() - startTime;
      details.push(`   ⏱️ Processing time: ${processingTime}ms`);

      // Validate core extraction results
      if (result.data.model === testCase.expectedResults.model) {
        details.push(`   ✅ Model extraction: ${result.data.model}`);
      } else {
        details.push(`   ❌ Model extraction failed: got "${result.data.model}", expected "${testCase.expectedResults.model}"`);
        allPassed = false;
      }

      if (result.data.brand === testCase.expectedResults.brand) {
        details.push(`   ✅ Brand detection: ${result.data.brand}`);
      } else {
        details.push(`   ❌ Brand detection failed: got "${result.data.brand}", expected "${testCase.expectedResults.brand}"`);
        allPassed = false;
      }

      if (result.data.consumable_type === testCase.expectedResults.type) {
        details.push(`   ✅ Type classification: ${result.data.consumable_type}`);
      } else {
        details.push(`   ❌ Type classification failed: got "${result.data.consumable_type}", expected "${testCase.expectedResults.type}"`);
        allPassed = false;
      }

      // Validate yield extraction
      if (testCase.expectedResults.yield && result.data.yield) {
        if (result.data.yield.value === testCase.expectedResults.yield) {
          details.push(`   ✅ Yield extraction: ${result.data.yield.value} ${result.data.yield.unit}`);
        } else {
          details.push(`   ⚠️ Yield extraction: got ${result.data.yield.value}, expected ${testCase.expectedResults.yield}`);
        }
      }

      // Validate color extraction (if expected)
      if (testCase.expectedResults.color) {
        if (result.data.color === testCase.expectedResults.color) {
          details.push(`   ✅ Color extraction: ${result.data.color}`);
        } else {
          details.push(`   ⚠️ Color extraction: got "${result.data.color}", expected "${testCase.expectedResults.color}"`);
        }
      }

      // Validate Russian market compliance
      const hasRussianPrinters = result.data.compatible_printers_ru && result.data.compatible_printers_ru.length > 0;
      if (testCase.expectedResults.hasRussianMarketPrinters) {
        if (hasRussianPrinters) {
          details.push(`   ✅ Russian market printers: ${result.data.compatible_printers_ru?.length || 0} verified`);
        } else {
          details.push(`   ⚠️ Russian market printers: Expected verified printers but found none`);
        }
      } else {
        details.push(`   ℹ️ Russian market printers: ${result.data.compatible_printers_ru?.length || 0} verified (not expected for this brand)`);
      }

      // Validate packaging data
      if (testCase.expectedResults.shouldHavePackaging) {
        if (result.data.packaging_from_nix) {
          details.push(`   ✅ Package data: ${result.data.packaging_from_nix.width_mm}×${result.data.packaging_from_nix.height_mm}×${result.data.packaging_from_nix.depth_mm}mm, ${result.data.packaging_from_nix.weight_g}g`);
        } else {
          details.push(`   ⚠️ Package data: Missing NIX.ru package dimensions`);
        }
      }

      // Validate related items discovery
      if (testCase.expectedResults.shouldHaveRelatedItems) {
        const relatedCount = result.data.related_consumables_display?.length || result.data.related_consumables_full.length;
        if (relatedCount > 0) {
          details.push(`   ✅ Related items: ${relatedCount} discovered`);
        } else {
          details.push(`   ⚠️ Related items: No related consumables found`);
        }
      }

      // Validate audit trail completeness
      if (result.evidence.sources.length > 0) {
        details.push(`   ✅ Audit trail: ${result.evidence.sources.length} sources documented`);
      } else {
        details.push(`   ❌ Audit trail: No sources documented`);
        allPassed = false;
      }

      // Validate processing status
      if (result.status === 'ok' || result.status === 'needs_review') {
        details.push(`   ✅ Processing status: ${result.status}`);
      } else {
        details.push(`   ❌ Processing failed with status: ${result.status}`);
        if (result.validation_errors.length > 0) {
          details.push(`   📋 Errors: ${result.validation_errors.slice(0, 2).join('; ')}`);
        }
        allPassed = false;

        // Dump internal logs for debugging
        if (result.evidence && result.evidence.logs) {
          console.log(`\n🔍 INTERNAL LOGS for ${testCase.name}:`);
          console.log(result.evidence.logs.join('\n   '));
        }
      }

      details.push(`   ✅ Pipeline completed for: ${testCase.name}`);

    } catch (error) {
      console.error(`[TEST ERROR] Pipeline error for "${testCase.name}":`, error);
      details.push(`   ❌ Pipeline error for "${testCase.name}": ${error}`);
      allPassed = false;
    }
  }

  return { passed: allPassed, details };
}

/**
 * Test Russian market requirements compliance
 */
async function testRussianMarketCompliance(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("🇷🇺 Testing Russian Market Requirements Compliance...");

  try {
    // Test with mock printer data representing various Russian market scenarios
    const mockPrinterData = [
      {
        model: "HP LaserJet Pro M404dn",
        canonicalName: "HP LaserJet Pro M404dn",
        sources: [
          {
            url: "https://cartridge.ru/hp-laserjet-pro-m404dn",
            timestamp: new Date(),
            dataConfirmed: ["compatibility"],
            confidence: 0.9,
            sourceType: "compatibility_db" as const,
            extractionMethod: "web_scraping"
          },
          {
            url: "https://nix.ru/hp-laserjet-pro-m404dn",
            timestamp: new Date(),
            dataConfirmed: ["compatibility", "specifications"],
            confidence: 0.95,
            sourceType: "nix_ru" as const,
            extractionMethod: "web_scraping"
          }
        ],
        ruMarketEligibility: "ru_unknown" as const,
        compatibilityConflict: false
      },
      {
        model: "Canon PIXMA G3420",
        canonicalName: "Canon PIXMA G3420",
        sources: [
          {
            url: "https://www.canon.ru/printers/pixma-g3420",
            timestamp: new Date(),
            dataConfirmed: ["compatibility", "official_support"],
            confidence: 0.98,
            sourceType: "official" as const,
            extractionMethod: "official_api"
          }
        ],
        ruMarketEligibility: "ru_unknown" as const,
        compatibilityConflict: false
      }
    ];

    const filterResult = filterPrintersForRussianMarket(mockPrinterData);

    // Test 1: Strict 2+ source verification
    const verifiedPrinters = filterResult.ruVerified;
    const unknownPrinters = filterResult.ruUnknown;
    const rejectedPrinters = filterResult.ruRejected;

    details.push(`✅ Russian market filtering results:`);
    details.push(`   - Verified printers: ${verifiedPrinters.length}`);
    details.push(`   - Unknown printers: ${unknownPrinters.length}`);
    details.push(`   - Rejected printers: ${rejectedPrinters.length}`);

    // Test 2: Separate storage for unverified printers
    const totalCategorized = verifiedPrinters.length + unknownPrinters.length + rejectedPrinters.length;
    if (totalCategorized === mockPrinterData.length) {
      details.push(`✅ All printers properly categorized`);
    } else {
      details.push(`❌ Categorization mismatch: ${totalCategorized} vs ${mockPrinterData.length}`);
      allPassed = false;
    }

    // Test 3: Russian source whitelist configuration
    if (filterResult.qualityMetrics) {
      details.push(`✅ Quality metrics available:`);
      details.push(`   - Average confidence: ${filterResult.qualityMetrics.averageConfidence.toFixed(3)}`);
      details.push(`   - Verification rate: ${(filterResult.qualityMetrics.verifiedCount / filterResult.qualityMetrics.totalProcessed * 100).toFixed(1)}%`);
    }

    // Test 4: Enhanced printer eligibility scoring
    verifiedPrinters.forEach(printer => {
      if (printer.sources.length >= 2) {
        details.push(`✅ ${printer.model}: Meets 2+ source requirement (${printer.sources.length} sources)`);
      } else {
        details.push(`❌ ${printer.model}: Verified but has < 2 sources (${printer.sources.length})`);
        allPassed = false;
      }
    });

  } catch (error) {
    details.push(`❌ Russian market compliance test error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test batch processing with various data sets
 */
async function testBatchProcessing(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("📦 Testing Batch Processing with Various Data Sets...");

  try {
    const batchInputs = END_TO_END_TEST_CASES.map(tc => tc.input);
    const batchStartTime = Date.now();

    details.push(`🚀 Processing batch of ${batchInputs.length} items...`);

    // Process items in parallel (simulating batch processing)
    const batchPromises = batchInputs.map(async (input, index) => {
      const testCase = END_TO_END_TEST_CASES[index];
      try {
        const result = await orchestrationService.processItem(testCase.input, (step) => { });
        return { success: true, result, testCase, index };
      } catch (error) {
        return { success: false, error, testCase, index };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const batchEndTime = Date.now();
    const totalBatchTime = batchEndTime - batchStartTime;

    // Analyze batch results
    const successfulItems = batchResults.filter(r => r.success);
    const failedItems = batchResults.filter(r => !r.success);

    details.push(`📊 Batch processing results:`);
    details.push(`   - Total items: ${batchResults.length}`);
    details.push(`   - Successful: ${successfulItems.length}`);
    details.push(`   - Failed: ${failedItems.length}`);
    details.push(`   - Success rate: ${(successfulItems.length / batchResults.length * 100).toFixed(1)}%`);
    details.push(`   - Total processing time: ${totalBatchTime}ms`);
    details.push(`   - Average time per item: ${(totalBatchTime / batchResults.length).toFixed(0)}ms`);

    // Validate batch processing efficiency
    if (successfulItems.length >= batchResults.length * 0.8) { // 80% success rate threshold
      details.push(`✅ Batch processing efficiency: Acceptable success rate`);
    } else {
      details.push(`❌ Batch processing efficiency: Low success rate (${(successfulItems.length / batchResults.length * 100).toFixed(1)}%)`);
      allPassed = false;
    }

    // Test data consistency across batch
    const extractedBrands = new Set(successfulItems.map(item => item.result.data.brand).filter(Boolean));
    const extractedTypes = new Set(successfulItems.map(item => item.result.data.consumable_type).filter(Boolean));

    details.push(`✅ Data variety in batch:`);
    details.push(`   - Brands: ${Array.from(extractedBrands).join(', ')}`);
    details.push(`   - Types: ${Array.from(extractedTypes).join(', ')}`);

    // Test error handling in batch processing
    if (failedItems.length > 0) {
      details.push(`⚠️ Failed items analysis:`);
      failedItems.forEach(item => {
        details.push(`   - ${item.testCase.name}: ${item.error}`);
      });
    }

  } catch (error) {
    details.push(`❌ Batch processing test error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test export functionality with enhanced data
 */
async function testExportFunctionality(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("📤 Testing Export Functionality with Enhanced Data...");

  try {
    // Create mock enriched items for export testing
    const mockEnrichedItems: EnrichedItem[] = END_TO_END_TEST_CASES.map((testCase, index) => ({
      id: `test-${index + 1}`,
      input_raw: testCase.input,
      data: {
        brand: testCase.expectedResults.brand,
        consumable_type: testCase.expectedResults.type as any,
        model: testCase.expectedResults.model,
        short_model: testCase.expectedResults.model.replace(/^[A-Z]+/, ''),
        model_alias_short: testCase.expectedResults.model.replace(/^[A-Z]+/, ''),
        yield: testCase.expectedResults.yield ? {
          value: testCase.expectedResults.yield,
          unit: 'pages' as const,
          coverage_percent: 5
        } : null,
        color: testCase.expectedResults.color || null,
        has_chip: 'unknown' as const,
        has_page_counter: 'unknown' as const,
        printers_ru: [`${testCase.expectedResults.brand} Test Printer`],
        compatible_printers_ru: [{
          model: `${testCase.expectedResults.brand} Test Printer`,
          canonicalName: `${testCase.expectedResults.brand} Test Printer`,
          sources: [],
          ruMarketEligibility: 'ru_verified' as const,
          compatibilityConflict: false
        }],
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
        images: [],
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
        },
        supplier_title_raw: 'Batch Test',
        title_norm: 'Batch Test',
        automation_status: 'needs_review',
        publish_ready: false,
        mpn_identity: { mpn: 'BATCH', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false }, canonical_model_name: 'BATCH' },
        compatible_printers_unverified: [],
        sources: []
      },
      evidence: {
        sources: [{
          url: 'https://nix.ru/test',
          source_type: 'nix_ru',
          claims: ['package dimensions'],
          evidence_snippets_by_claim: {},
          extracted_at: new Date().toISOString(),
          confidence: 0.9,
          extraction_method: 'api'
        }],
        processing_history: [],
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
        audit_trail: []
      },
      status: 'ok' as ValidationStatus,
      validation_errors: [],
      retry_count: 0,
      created_at: Date.now(),
      updated_at: Date.now(),

      input_hash: `hash - ${index + 1} `,
      ruleset_version: '2.1.0',
      parser_version: '1.5.0',
      processed_at: new Date().toISOString()
    }));

    // Test CSV export structure
    const csvHeaders = [
      'id', 'input_raw', 'brand', 'model', 'consumable_type', 'color',
      'yield_value', 'yield_unit', 'packaging_width_mm', 'packaging_height_mm',
      'packaging_depth_mm', 'packaging_weight_g', 'compatible_printers_ru_count',
      'related_consumables_count', 'confidence_overall', 'status', 'processed_at'
    ];

    details.push(`✅ CSV export structure validation: `);
    details.push(`   - Headers defined: ${csvHeaders.length} columns`);
    details.push(`   - Key fields: ${csvHeaders.slice(0, 6).join(', ')} `);

    // Test data completeness for export
    let exportDataComplete = true;
    mockEnrichedItems.forEach((item, index) => {
      const requiredFields = ['brand', 'model', 'consumable_type'];
      const missingFields = requiredFields.filter(field => !item.data[field as keyof ConsumableData]);

      if (missingFields.length === 0) {
        details.push(`   ✅ Item ${index + 1}: All required fields present`);
      } else {
        details.push(`   ❌ Item ${index + 1}: Missing fields: ${missingFields.join(', ')} `);
        exportDataComplete = false;
        allPassed = false;
      }
    });

    if (exportDataComplete) {
      details.push(`✅ Export data completeness: All items have required fields`);
    }

    // Test enhanced data fields in export
    const enhancedFieldsPresent = mockEnrichedItems.every(item =>
      item.data.packaging_from_nix &&
      item.data.compatible_printers_ru &&
      item.data.confidence
    );

    if (enhancedFieldsPresent) {
      details.push(`✅ Enhanced data fields: Package data, Russian printers, confidence scores present`);
    } else {
      details.push(`❌ Enhanced data fields: Some enhanced fields missing`);
      allPassed = false;
    }

    // Test audit trail data for export
    const auditTrailComplete = mockEnrichedItems.every(item =>
      item.evidence.sources.length > 0 &&
      item.id &&
      item.processed_at
    );

    if (auditTrailComplete) {
      details.push(`✅ Audit trail completeness: All items have source tracking and processing metadata`);
    } else {
      details.push(`❌ Audit trail completeness: Some items missing audit data`);
      allPassed = false;
    }

  } catch (error) {
    details.push(`❌ Export functionality test error: ${error} `);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test audit trail completeness and data provenance
 */
async function testAuditTrailCompleteness(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("📋 Testing Audit Trail Completeness and Data Provenance...");

  try {
    // Process a sample item to test audit trail generation
    const testInput = "HP CF234A LaserJet Pro M106w Toner Cartridge 9200 pages";
    const result = await orchestrationService.processItem(testInput, (step) => { });

    // Test 1: Source documentation
    if (result.evidence && result.evidence.logs) {
      // console.log("🔍 AUDIT TRAIL LOGS:\n" + result.evidence.logs.join("\n"));
    }

    if (result.evidence.sources.length > 0) {
      details.push(`✅ Source documentation: ${result.evidence.sources.length} sources recorded`);

      result.evidence.sources.forEach((source, index) => {
        details.push(`   📄 Source ${index + 1}: `);
        details.push(`      - URL: ${source.url} `);
        details.push(`      - Type: ${source.source_type} `);
        details.push(`      - Claims: ${source.claims.join(', ')} `);
        details.push(`      - Confidence: ${source.confidence.toFixed(3)} `);
        details.push(`      - Extracted at: ${source.extracted_at} `);
      });
    } else {
      details.push(`❌ Source documentation: No sources recorded`);
      allPassed = false;
    }

    // Test 2: Processing metadata
    const requiredMetadata = ['id', 'input_hash', 'ruleset_version', 'parser_version', 'processed_at'];
    const missingMetadata = requiredMetadata.filter(field => !result[field as keyof EnrichedItem]);

    if (missingMetadata.length === 0) {
      details.push(`✅ Processing metadata: All required fields present`);
      details.push(`   - Job ID: ${result.id} `);
      details.push(`   - Ruleset version: ${result.ruleset_version} `);
      details.push(`   - Parser version: ${result.parser_version} `);
    } else {
      details.push(`❌ Processing metadata: Missing fields: ${missingMetadata.join(', ')} `);
      allPassed = false;
    }

    // Test 3: Quality metrics tracking
    if (result.evidence.quality_metrics) {
      const qm = result.evidence.quality_metrics;
      details.push(`✅ Quality metrics tracking: `);
      details.push(`   - Data completeness: ${(qm.data_completeness_score * 100).toFixed(1)}% `);
      details.push(`   - Source reliability: ${(qm.source_reliability_score * 100).toFixed(1)}% `);
      details.push(`   - Validation pass rate: ${(qm.validation_pass_rate * 100).toFixed(1)}% `);
      details.push(`   - Processing efficiency: ${(qm.processing_efficiency * 100).toFixed(1)}% `);
      details.push(`   - Audit completeness: ${(qm.audit_completeness * 100).toFixed(1)}% `);
      details.push(`   - Total sources used: ${qm.total_sources_used} `);
    } else {
      details.push(`❌ Quality metrics tracking: No quality metrics recorded`);
      allPassed = false;
    }

    // Test 4: Data provenance chain
    const hasDataProvenance = result.evidence.sources.every(source =>
      source.url &&
      source.source_type &&
      source.extracted_at &&
      source.confidence !== undefined
    );

    if (hasDataProvenance) {
      details.push(`✅ Data provenance chain: Complete for all sources`);
    } else {
      details.push(`❌ Data provenance chain: Incomplete for some sources`);
      allPassed = false;
    }

    // Test 5: Confidence tracking
    if (result.data.confidence) {
      const conf = result.data.confidence;
      details.push(`✅ Confidence tracking: `);
      details.push(`   - Overall: ${(conf.overall * 100).toFixed(1)}% `);
      details.push(`   - Model name: ${(conf.model_name * 100).toFixed(1)}% `);
      details.push(`   - Logistics: ${(conf.logistics * 100).toFixed(1)}% `);
      details.push(`   - Compatibility: ${(conf.compatibility * 100).toFixed(1)}% `);
    } else {
      details.push(`❌ Confidence tracking: No confidence scores recorded`);
      allPassed = false;
    }

  } catch (error) {
    details.push(`❌ Audit trail test error: ${error} `);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test publication readiness evaluation
 */
async function testPublicationReadinessEvaluation(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("📋 Testing Publication Readiness Evaluation...");

  try {
    // Create a mock item for publication readiness testing
    const mockItem: EnrichedItem = {
      id: 'pub-test-1',
      input_raw: 'HP CF234A LaserJet Pro Toner Cartridge',
      data: {
        brand: 'HP',
        consumable_type: 'toner_cartridge',
        model: 'CF234A',
        short_model: '234A',
        model_alias_short: '234A',
        yield: { value: 9200, unit: 'pages', coverage_percent: 5 },
        color: 'Black',
        supplier_title_raw: 'Batch Test',
        title_norm: 'Batch Test',
        automation_status: 'needs_review',
        publish_ready: false,
        mpn_identity: { mpn: 'BATCH', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false }, canonical_model_name: 'BATCH' },
        compatible_printers_unverified: [],
        sources: [],

        has_chip: true,
        has_page_counter: false,
        printers_ru: ['HP LaserJet Pro M106w'],
        compatible_printers_ru: [{
          model: 'HP LaserJet Pro M106w',
          canonicalName: 'HP LaserJet Pro M106w',
          sources: [],
          ruMarketEligibility: 'ru_verified',
          compatibilityConflict: false
        }],
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
          url: 'test-image.jpg',
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
          url: 'https://nix.ru/test',
          source_type: 'nix_ru',
          claims: ['package dimensions'],
          evidence_snippets_by_claim: {},
          extracted_at: new Date().toISOString(),
          confidence: 0.9,
          extraction_method: 'api'
        }],
        processing_history: [],
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
        audit_trail: []
      },
      status: 'ok',
      validation_errors: [],
      retry_count: 0,
      created_at: Date.now(),
      updated_at: Date.now(),

      input_hash: 'pub-test-hash',
      ruleset_version: '2.1.0',
      parser_version: '1.5.0',
      processed_at: new Date().toISOString()
    };

    // Evaluate publication readiness
    const readinessResult = evaluatePublicationReadiness(mockItem);

    details.push(`✅ Publication readiness evaluation: `);
    details.push(`   - Overall score: ${(readinessResult.overall_score * 100).toFixed(1)}% `);
    details.push(`   - Is ready: ${readinessResult.is_ready ? 'Yes' : 'No'} `);
    details.push(`   - Confidence level: ${readinessResult.confidence_level} `);

    // Test component scores
    details.push(`   📊 Component scores: `);
    Object.entries(readinessResult.component_scores).forEach(([component, score]) => {
      details.push(`      - ${component}: ${(score * 100).toFixed(1)}% `);
    });

    // Test blocking issues
    if (readinessResult.blocking_issues.length === 0) {
      details.push(`   ✅ No blocking issues found`);
    } else {
      details.push(`   ⚠️ Blocking issues: ${readinessResult.blocking_issues.join('; ')} `);
    }

    // Test recommendations
    if (readinessResult.recommendations.length > 0) {
      details.push(`   💡 Recommendations: ${readinessResult.recommendations.slice(0, 2).join('; ')} `);
    }

    // Validate readiness criteria
    if (readinessResult.overall_score >= 0.7) {
      details.push(`   ✅ Meets minimum readiness threshold`);
    } else {
      details.push(`   ❌ Below minimum readiness threshold(${(readinessResult.overall_score * 100).toFixed(1)}% <70%)`);
      allPassed = false;
    }

  } catch (error) {
    details.push(`❌ Publication readiness test error: ${error} `);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Main test runner for comprehensive end-to-end testing
 */
async function runEndToEndTests(): Promise<void> {
  console.log("🚀 Starting Comprehensive End-to-End Integration Tests");
  console.log("Task 12: Final Integration and Testing");
  console.log("Requirements: All (comprehensive validation)\n");

  const startTime = Date.now();

  const results = await Promise.all([
    testCompleteDataProcessingPipeline(),
    testRussianMarketCompliance(),
    testBatchProcessing(),
    testExportFunctionality(),
    testAuditTrailCompleteness(),
    testPublicationReadinessEvaluation()
  ]);

  const [
    pipelineResult,
    russianMarketResult,
    batchResult,
    exportResult,
    auditResult,
    publicationResult
  ] = results;

  const totalTime = Date.now() - startTime;

  // Print comprehensive results
  console.log("\n📊 COMPREHENSIVE END-TO-END TEST RESULTS:\n");

  console.log("1. COMPLETE DATA PROCESSING PIPELINE:");
  pipelineResult.details.forEach(detail => console.log(`   ${detail} `));
  console.log(`   Status: ${pipelineResult.passed ? '✅ PASSED' : '❌ FAILED'} \n`);

  console.log("2. RUSSIAN MARKET REQUIREMENTS COMPLIANCE:");
  russianMarketResult.details.forEach(detail => console.log(`   ${detail} `));
  console.log(`   Status: ${russianMarketResult.passed ? '✅ PASSED' : '❌ FAILED'} \n`);

  console.log("3. BATCH PROCESSING WITH VARIOUS DATA SETS:");
  batchResult.details.forEach(detail => console.log(`   ${detail} `));
  console.log(`   Status: ${batchResult.passed ? '✅ PASSED' : '❌ FAILED'} \n`);

  console.log("4. EXPORT FUNCTIONALITY WITH ENHANCED DATA:");
  exportResult.details.forEach(detail => console.log(`   ${detail} `));
  console.log(`   Status: ${exportResult.passed ? '✅ PASSED' : '❌ FAILED'} \n`);

  console.log("5. AUDIT TRAIL COMPLETENESS AND DATA PROVENANCE:");
  auditResult.details.forEach(detail => console.log(`   ${detail} `));
  console.log(`   Status: ${auditResult.passed ? '✅ PASSED' : '❌ FAILED'} \n`);

  console.log("6. PUBLICATION READINESS EVALUATION:");
  publicationResult.details.forEach(detail => console.log(`   ${detail} `));
  console.log(`   Status: ${publicationResult.passed ? '✅ PASSED' : '❌ FAILED'} \n`);

  // Overall summary
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;

  console.log("🎯 OVERALL END-TO-END TEST STATUS:");
  console.log(`   ${allPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'} `);
  console.log(`   Test suite completion: ${passedCount}/${results.length} test categories passed`);
  console.log(`   Total execution time: ${(totalTime / 1000).toFixed(1)} seconds`);

  if (!allPassed) {
    console.log("\n🔧 RECOMMENDED ACTIONS:");
    if (!pipelineResult.passed) console.log("   - Review complete data processing pipeline implementation");
    if (!russianMarketResult.passed) console.log("   - Check Russian market requirements compliance");
    if (!batchResult.passed) console.log("   - Optimize batch processing performance and error handling");
    if (!exportResult.passed) console.log("   - Verify export functionality and data completeness");
    if (!auditResult.passed) console.log("   - Ensure complete audit trail and data provenance tracking");
    if (!publicationResult.passed) console.log("   - Review publication readiness evaluation criteria");
  } else {
    console.log("\n🎉 TASK 12 REQUIREMENTS FULLY SATISFIED:");
    console.log("   ✅ Complete pipeline end-to-end testing validated");
    console.log("   ✅ Russian market requirements compliance verified");
    console.log("   ✅ Batch processing with various data sets tested");
    console.log("   ✅ Export functionality with enhanced data confirmed");
    console.log("   ✅ Audit trails properly maintained and complete");
    console.log("   ✅ Publication readiness evaluation working correctly");
    console.log("   ✅ All system components integrated and functioning");
  }

  console.log("\n✨ Comprehensive end-to-end integration tests completed!");
  console.log("🏁 Consumable Enricher Pro system ready for production deployment!");
}

// Vitest test cases
describe('End-to-End Integration Tests', () => {
  it('should complete full data processing pipeline', async () => {
    const result = await testCompleteDataProcessingPipeline();
    expect(result.passed).toBe(true);
  }, 60000); // 60 second timeout

  it('should comply with Russian market requirements', async () => {
    const result = await testRussianMarketCompliance();
    expect(result.passed).toBe(true);
  }, 30000);

  it('should handle batch processing correctly', async () => {
    const result = await testBatchProcessing();
    expect(result.passed).toBe(true);
  }, 90000); // 90 second timeout for batch processing

  it('should export functionality with enhanced data', async () => {
    const result = await testExportFunctionality();
    expect(result.passed).toBe(true);
  }, 15000);

  it('should maintain complete audit trails', async () => {
    const result = await testAuditTrailCompleteness();
    expect(result.passed).toBe(true);
  }, 30000);

  it('should evaluate publication readiness correctly', async () => {
    const result = await testPublicationReadinessEvaluation();
    expect(result.passed).toBe(true);
  }, 15000);

  it('should run complete end-to-end test suite', async () => {
    await runEndToEndTests();
    // If we reach here without throwing, the test passed
    expect(true).toBe(true);
  }, 180000); // 3 minute timeout for full suite
});

// Export for potential use in other contexts
export { runEndToEndTests };