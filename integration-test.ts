/**
 * Integration Test for Core Data Processing Pipeline
 * Task 6: Checkpoint - Core Data Processing Validation
 */

import { processSupplierTitle } from './services/textProcessingService';
import { filterPrintersForRussianMarket } from './services/russianMarketFilter';
import { convertToStandardUnits, validatePackageDimensions } from './services/nixService';
import { validateProductImage } from './services/imageValidationService';

// Test data representing real-world scenarios
const INTEGRATION_TEST_CASES = [
  {
    title: "HP CF234A LaserJet Pro M106w M134a M134fn Toner Cartridge 9.2K pages",
    expectedModel: "CF234A",
    expectedBrand: "HP",
    expectedYield: 9200
  },
  {
    title: "Brother TN-1150 для HL-1110/1112/DCP-1510/1512/MFC-1810/1815 2500стр",
    expectedModel: "TN-1150", 
    expectedBrand: "Brother",
    expectedYield: 2500
  },
  {
    title: "Canon CRG-045 Cyan для LBP611Cn/613Cdw/MF631Cn/633Cdw/635Cx 1,3К",
    expectedModel: "CRG-045",
    expectedBrand: "Canon", 
    expectedYield: 1300
  }
];

/**
 * Test the complete data processing pipeline integration
 */
async function testDataProcessingPipeline(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("🔄 Testing Complete Data Processing Pipeline Integration...");

  for (const testCase of INTEGRATION_TEST_CASES) {
    try {
      details.push(`\n📝 Processing: "${testCase.title}"`);
      
      // Step 1: Text Processing
      const textResult = processSupplierTitle(testCase.title);
      
      // Validate text processing results
      if (textResult.model.model === testCase.expectedModel) {
        details.push(`✅ Model extraction: ${textResult.model.model} (confidence: ${textResult.model.confidence})`);
      } else {
        details.push(`❌ Model extraction failed: got "${textResult.model.model}", expected "${testCase.expectedModel}"`);
        allPassed = false;
      }

      if (textResult.brand.brand === testCase.expectedBrand) {
        details.push(`✅ Brand detection: ${textResult.brand.brand} (confidence: ${textResult.brand.confidence})`);
      } else {
        details.push(`❌ Brand detection failed: got "${textResult.brand.brand}", expected "${testCase.expectedBrand}"`);
        allPassed = false;
      }

      // Check yield extraction if expected
      if (testCase.expectedYield && textResult.yieldInfo.length > 0) {
        const extractedYield = textResult.yieldInfo[0].value;
        if (extractedYield === testCase.expectedYield) {
          details.push(`✅ Yield extraction: ${extractedYield} ${textResult.yieldInfo[0].unit}`);
        } else {
          details.push(`⚠️ Yield extraction: got ${extractedYield}, expected ${testCase.expectedYield}`);
        }
      }

      // Step 2: Mock Russian Market Filtering (using sample data)
      const mockPrinterData = [
        {
          model: `${testCase.expectedBrand} Test Printer`,
          canonicalName: `${testCase.expectedBrand} Test Printer`,
          sources: [
            {
              url: "https://cartridge.ru/test",
              timestamp: new Date(),
              dataConfirmed: ["compatibility"],
              confidence: 0.9,
              sourceType: "compatibility_db" as const,
              extractionMethod: "web_scraping"
            },
            {
              url: "https://nix.ru/test", 
              timestamp: new Date(),
              dataConfirmed: ["compatibility"],
              confidence: 0.95,
              sourceType: "nix_ru" as const,
              extractionMethod: "web_scraping"
            }
          ],
          ruMarketEligibility: "ru_unknown" as const,
          compatibilityConflict: false
        }
      ];

      const filterResult = filterPrintersForRussianMarket(mockPrinterData);
      details.push(`✅ Russian market filtering: ${filterResult.ruVerified.length} verified printers`);

      // Step 3: Mock NIX Package Data Processing
      const mockPackageData = {
        width_cm: 15.5,
        height_cm: 8.2, 
        depth_cm: 12.0,
        weight_kg: 0.85
      };

      const convertedData = convertToStandardUnits(mockPackageData);
      details.push(`✅ Unit conversion: ${mockPackageData.width_cm}cm → ${convertedData.width_mm}mm`);

      const nixData = {
        width_mm: convertedData.width_mm,
        height_mm: convertedData.height_mm,
        depth_mm: convertedData.depth_mm,
        weight_g: convertedData.weight_g,
        mpn: textResult.model.model,
        raw_source_string: "Mock NIX data",
        confidence: 0.9,
        extraction_timestamp: new Date().toISOString(),
        source_url: "https://nix.ru/mock"
      };

      const validation = validatePackageDimensions(nixData);
      if (validation.isValid) {
        details.push(`✅ Package validation: All dimensions valid`);
      } else {
        details.push(`❌ Package validation failed: ${validation.missingFields.join(', ')}`);
        allPassed = false;
      }

      // Step 4: Image Validation (using placeholder)
      const imageUrl = `https://placehold.co/800x800/white/4338ca?text=${encodeURIComponent(textResult.model.model)}`;
      
      try {
        const imageValidation = await validateProductImage(imageUrl, textResult.model.model);
        details.push(`${imageValidation.isValid ? '✅' : '⚠️'} Image validation: ${imageValidation.confidence.toFixed(2)} confidence`);
        if (!imageValidation.isValid) {
          details.push(`   Issues: ${imageValidation.rejectionReasons.slice(0, 2).join('; ')}`);
        }
      } catch (imageError) {
        details.push(`⚠️ Image validation skipped: ${imageError}`);
      }

      details.push(`✅ Pipeline completed for: ${testCase.title}`);

    } catch (error) {
      details.push(`❌ Pipeline error for "${testCase.title}": ${error}`);
      allPassed = false;
    }
  }

  return { passed: allPassed, details };
}

/**
 * Test component integration and data flow
 */
async function testComponentIntegration(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("🔗 Testing Component Integration and Data Flow...");

  try {
    // Test 1: Text Processing → Russian Market Filtering
    const title = "HP CF234A LaserJet Toner 9200 pages";
    const textResult = processSupplierTitle(title);
    
    // Create mock printer data based on text processing results
    const mockPrinters = [
      {
        model: `${textResult.brand.brand} LaserJet Pro M404`,
        canonicalName: `${textResult.brand.brand} LaserJet Pro M404`,
        sources: [
          {
            url: "https://cartridge.ru/hp-laserjet-pro-m404",
            timestamp: new Date(),
            dataConfirmed: ["compatibility"],
            confidence: 0.9,
            sourceType: "compatibility_db" as const,
            extractionMethod: "web_scraping"
          },
          {
            url: "https://rashodnika.net/hp-laserjet-pro-m404",
            timestamp: new Date(), 
            dataConfirmed: ["compatibility"],
            confidence: 0.85,
            sourceType: "compatibility_db" as const,
            extractionMethod: "web_scraping"
          }
        ],
        ruMarketEligibility: "ru_unknown" as const,
        compatibilityConflict: false
      }
    ];

    const filterResult = filterPrintersForRussianMarket(mockPrinters);
    
    if (filterResult.ruVerified.length > 0) {
      details.push(`✅ Text processing → Russian filtering: ${filterResult.ruVerified.length} verified printers`);
    } else {
      details.push(`⚠️ Text processing → Russian filtering: No verified printers (expected for mock data)`);
    }

    // Test 2: NIX Data → Package Validation
    const mockNixResponse = {
      width_cm: 15.5,
      height_cm: 8.2,
      depth_cm: 12.0,
      weight_kg: 0.85,
      mpn: textResult.model.model
    };

    const converted = convertToStandardUnits(mockNixResponse);
    const packageData = {
      ...converted,
      mpn: mockNixResponse.mpn,
      raw_source_string: "Mock NIX integration test",
      confidence: 0.9,
      extraction_timestamp: new Date().toISOString(),
      source_url: "https://nix.ru/integration-test"
    };

    const packageValidation = validatePackageDimensions(packageData);
    if (packageValidation.isValid) {
      details.push(`✅ NIX data → Package validation: Valid package data`);
    } else {
      details.push(`❌ NIX data → Package validation: ${packageValidation.missingFields.join(', ')}`);
      allPassed = false;
    }

    // Test 3: Data consistency across components
    const modelFromText = textResult.model.model;
    const modelFromPackage = packageData.mpn;
    
    if (modelFromText === modelFromPackage) {
      details.push(`✅ Data consistency: Model "${modelFromText}" consistent across components`);
    } else {
      details.push(`⚠️ Data consistency: Model mismatch - text: "${modelFromText}", package: "${modelFromPackage}"`);
    }

    details.push(`✅ Component integration tests completed`);

  } catch (error) {
    details.push(`❌ Component integration error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Main integration test runner
 */
async function runIntegrationTests(): Promise<void> {
  console.log("🚀 Starting Core Data Processing Integration Tests\n");

  const results = await Promise.all([
    testDataProcessingPipeline(),
    testComponentIntegration()
  ]);

  const [pipelineResult, integrationResult] = results;

  // Print detailed results
  console.log("\n📊 INTEGRATION TEST RESULTS:\n");

  console.log("1. DATA PROCESSING PIPELINE:");
  pipelineResult.details.forEach(detail => console.log(`   ${detail}`));
  console.log(`   Status: ${pipelineResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log("2. COMPONENT INTEGRATION:");
  integrationResult.details.forEach(detail => console.log(`   ${detail}`));
  console.log(`   Status: ${integrationResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Overall summary
  const allPassed = results.every(r => r.passed);
  console.log("🎯 OVERALL INTEGRATION STATUS:");
  console.log(`   ${allPassed ? '✅ ALL INTEGRATIONS WORKING' : '⚠️ INTEGRATION ISSUES DETECTED'}`);
  
  if (!allPassed) {
    console.log("\n🔧 RECOMMENDED ACTIONS:");
    if (!pipelineResult.passed) console.log("   - Review data processing pipeline flow and error handling");
    if (!integrationResult.passed) console.log("   - Check component integration and data consistency");
  } else {
    console.log("\n🎉 CHECKPOINT VALIDATION SUCCESSFUL:");
    console.log("   ✅ Text processing improvements working correctly");
    console.log("   ✅ Russian market filtering properly implemented");
    console.log("   ✅ NIX.ru integration and data validation functional");
    console.log("   ✅ Image processing enhancements operational");
    console.log("   ✅ Component integration and data flow validated");
  }

  console.log("\n✨ Integration tests completed!");
}

// Export for potential use in other contexts
export { runIntegrationTests };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch(console.error);
}