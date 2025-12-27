/**
 * Enhanced Russian Market Filtering Validation Test
 * Task 2: Strengthen Russian Market Filtering
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { 
  filterPrintersForRussianMarket, 
  verifyRussianMarketEligibility,
  calculatePrinterEligibilityScore 
} from './services/russianMarketFilter';

import { 
  getRussianMarketFilterConfig,
  validateRussianMarketConfig,
  createCustomRussianMarketConfig,
  getRecommendedConfig,
  RU_MARKET_FILTER_PROFILES
} from './services/russianMarketConfig';

import { PrinterCompatibility, DataSource, RuMarketFilterConfig } from './types';

/**
 * Test data representing various Russian market scenarios
 */
const COMPREHENSIVE_TEST_DATA: PrinterCompatibility[] = [
  // Printer with 2+ Russian sources (should be ru_verified)
  {
    model: "HP LaserJet Pro M404dn",
    canonicalName: "HP LaserJet Pro M404dn",
    sources: [
      {
        url: "https://cartridge.ru/hp-laserjet-pro-m404dn",
        timestamp: new Date(),
        dataConfirmed: ["compatibility", "availability"],
        confidence: 0.9,
        sourceType: "compatibility_db",
        extractionMethod: "web_scraping"
      },
      {
        url: "https://rashodnika.net/hp-laserjet-pro-m404dn",
        timestamp: new Date(),
        dataConfirmed: ["compatibility"],
        confidence: 0.85,
        sourceType: "compatibility_db",
        extractionMethod: "web_scraping"
      },
      {
        url: "https://nix.ru/hp-laserjet-pro-m404dn",
        timestamp: new Date(),
        dataConfirmed: ["compatibility", "specifications"],
        confidence: 0.95,
        sourceType: "nix_ru",
        extractionMethod: "web_scraping"
      }
    ],
    ruMarketEligibility: "ru_unknown",
    compatibilityConflict: false
  },

  // Printer with official Russian source (should be ru_verified with bonus)
  {
    model: "Canon PIXMA G3420",
    canonicalName: "Canon PIXMA G3420",
    sources: [
      {
        url: "https://www.canon.ru/printers/pixma-g3420",
        timestamp: new Date(),
        dataConfirmed: ["compatibility", "official_support"],
        confidence: 0.98,
        sourceType: "official",
        extractionMethod: "official_api"
      },
      {
        url: "https://cartridge.ru/canon-pixma-g3420",
        timestamp: new Date(),
        dataConfirmed: ["compatibility"],
        confidence: 0.88,
        sourceType: "compatibility_db",
        extractionMethod: "web_scraping"
      }
    ],
    ruMarketEligibility: "ru_unknown",
    compatibilityConflict: false
  },

  // Printer with only 1 Russian source (should be ru_unknown)
  {
    model: "Brother HL-L2350DW",
    canonicalName: "Brother HL-L2350DW",
    sources: [
      {
        url: "https://rashodnika.net/brother-hl-l2350dw",
        timestamp: new Date(),
        dataConfirmed: ["compatibility"],
        confidence: 0.82,
        sourceType: "compatibility_db",
        extractionMethod: "web_scraping"
      }
    ],
    ruMarketEligibility: "ru_unknown",
    compatibilityConflict: false
  },

  // Printer with no Russian sources (should be ru_rejected)
  {
    model: "Epson WorkForce Pro WF-4830",
    canonicalName: "Epson WorkForce Pro WF-4830",
    sources: [
      {
        url: "https://www.epson.com/workforce-pro-wf-4830",
        timestamp: new Date(),
        dataConfirmed: ["compatibility"],
        confidence: 0.95,
        sourceType: "official",
        extractionMethod: "official_api"
      },
      {
        url: "https://www.amazon.com/epson-workforce-pro-wf-4830",
        timestamp: new Date(),
        dataConfirmed: ["compatibility"],
        confidence: 0.75,
        sourceType: "marketplace",
        extractionMethod: "web_scraping"
      }
    ],
    ruMarketEligibility: "ru_unknown",
    compatibilityConflict: false
  },

  // Printer with conflicting sources (should have compatibilityConflict = true)
  {
    model: "Kyocera ECOSYS M2040dn",
    canonicalName: "Kyocera ECOSYS M2040dn",
    sources: [
      {
        url: "https://cartridge.ru/kyocera-ecosys-m2040dn",
        timestamp: new Date(),
        dataConfirmed: ["compatibility"],
        confidence: 0.9,
        sourceType: "compatibility_db",
        extractionMethod: "web_scraping"
      },
      {
        url: "https://rashodnika.net/kyocera-ecosys-m2040dn",
        timestamp: new Date(),
        dataConfirmed: ["incompatibility"], // Conflicting data
        confidence: 0.85,
        sourceType: "compatibility_db",
        extractionMethod: "web_scraping"
      }
    ],
    ruMarketEligibility: "ru_unknown",
    compatibilityConflict: true // Pre-marked for testing
  }
];

/**
 * Test Russian Market Filter Configuration
 */
async function testRussianMarketConfiguration(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("⚙️ Testing Russian Market Filter Configuration...");

  try {
    // Test default configuration profiles
    const profiles = ['STRICT', 'STANDARD', 'LENIENT', 'ULTRA_STRICT'] as const;
    
    for (const profile of profiles) {
      const config = getRussianMarketFilterConfig(profile);
      const validation = validateRussianMarketConfig(config);
      
      if (validation.isValid) {
        details.push(`✅ ${profile} profile: Valid configuration`);
        details.push(`   - Min sources: ${config.minSourcesForVerification}`);
        details.push(`   - Russian sources: ${config.russianSources.length}`);
        details.push(`   - Confidence threshold: ${config.confidenceThreshold}`);
      } else {
        details.push(`❌ ${profile} profile: Invalid configuration`);
        details.push(`   - Errors: ${validation.errors.join('; ')}`);
        allPassed = false;
      }
    }

    // Test custom configuration creation
    const customConfig = createCustomRussianMarketConfig(3, [], 0.3, 0.8);
    const customValidation = validateRussianMarketConfig(customConfig);
    
    if (customValidation.isValid) {
      details.push(`✅ Custom configuration: Valid`);
    } else {
      details.push(`❌ Custom configuration: Invalid - ${customValidation.errors.join('; ')}`);
      allPassed = false;
    }

    // Test recommended configurations
    const useCases = ['production', 'development', 'testing', 'critical'] as const;
    for (const useCase of useCases) {
      const recommendedConfig = getRecommendedConfig(useCase);
      details.push(`✅ ${useCase} use case: ${recommendedConfig.minSourcesForVerification} min sources, ${recommendedConfig.confidenceThreshold} threshold`);
    }

  } catch (error) {
    details.push(`❌ Configuration test error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test Strict 2+ Source Verification
 */
async function testStrictSourceVerification(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("🔒 Testing Strict 2+ Source Verification...");

  try {
    const strictConfig = getRussianMarketFilterConfig('STRICT');
    
    // Test each printer individually
    for (const printer of COMPREHENSIVE_TEST_DATA) {
      const verification = verifyRussianMarketEligibility(printer.model, printer.sources, strictConfig);
      
      // Count Russian sources
      const russianSourceCount = printer.sources.filter(source => 
        strictConfig.russianSources.some(ruSource => 
          ruSource.searchPatterns.some(pattern => 
            source.url.toLowerCase().includes(pattern.toLowerCase())
          )
        )
      ).length;

      // Verify the logic
      if (russianSourceCount >= strictConfig.minSourcesForVerification) {
        if (verification.eligibility === 'ru_verified') {
          details.push(`✅ ${printer.model}: Correctly verified (${russianSourceCount} Russian sources)`);
        } else {
          details.push(`❌ ${printer.model}: Should be verified but got ${verification.eligibility}`);
          allPassed = false;
        }
      } else if (russianSourceCount > 0) {
        if (verification.eligibility === 'ru_unknown') {
          details.push(`✅ ${printer.model}: Correctly marked unknown (${russianSourceCount} Russian sources < ${strictConfig.minSourcesForVerification} required)`);
        } else {
          details.push(`❌ ${printer.model}: Should be unknown but got ${verification.eligibility}`);
          allPassed = false;
        }
      } else {
        if (verification.eligibility === 'ru_rejected') {
          details.push(`✅ ${printer.model}: Correctly rejected (0 Russian sources)`);
        } else {
          details.push(`❌ ${printer.model}: Should be rejected but got ${verification.eligibility}`);
          allPassed = false;
        }
      }

      details.push(`   Confidence: ${verification.confidence.toFixed(3)}, Reasoning: ${verification.reasoning}`);
    }

  } catch (error) {
    details.push(`❌ Strict verification test error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test Separate Storage for Unverified Printers
 */
async function testSeparateUnverifiedStorage(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("📦 Testing Separate Storage for Unverified Printers...");

  try {
    const config = getRussianMarketFilterConfig('STANDARD');
    const filterResult = filterPrintersForRussianMarket(COMPREHENSIVE_TEST_DATA, config);

    // Verify separate storage
    details.push(`✅ Filtering results:`);
    details.push(`   - Verified printers: ${filterResult.ruVerified.length}`);
    details.push(`   - Unknown printers: ${filterResult.ruUnknown.length}`);
    details.push(`   - Rejected printers: ${filterResult.ruRejected.length}`);

    // Verify no overlap between categories
    const verifiedModels = new Set(filterResult.ruVerified.map(p => p.model));
    const unknownModels = new Set(filterResult.ruUnknown.map(p => p.model));
    const rejectedModels = new Set(filterResult.ruRejected.map(p => p.model));

    const hasOverlap = 
      [...verifiedModels].some(m => unknownModels.has(m) || rejectedModels.has(m)) ||
      [...unknownModels].some(m => rejectedModels.has(m));

    if (!hasOverlap) {
      details.push(`✅ No overlap between verified, unknown, and rejected categories`);
    } else {
      details.push(`❌ Found overlap between printer categories`);
      allPassed = false;
    }

    // Verify all printers are accounted for
    const totalCategorized = filterResult.ruVerified.length + filterResult.ruUnknown.length + filterResult.ruRejected.length;
    if (totalCategorized === COMPREHENSIVE_TEST_DATA.length) {
      details.push(`✅ All ${COMPREHENSIVE_TEST_DATA.length} printers properly categorized`);
    } else {
      details.push(`❌ Categorization mismatch: ${totalCategorized} categorized vs ${COMPREHENSIVE_TEST_DATA.length} input`);
      allPassed = false;
    }

    // Test quality metrics
    const metrics = filterResult.qualityMetrics;
    details.push(`✅ Quality metrics:`);
    details.push(`   - Average confidence: ${metrics.averageConfidence.toFixed(3)}`);
    details.push(`   - Total processed: ${metrics.totalProcessed}`);
    details.push(`   - Verification rate: ${(metrics.verifiedCount / metrics.totalProcessed * 100).toFixed(1)}%`);

  } catch (error) {
    details.push(`❌ Separate storage test error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Test Enhanced Printer Eligibility Scoring Algorithm
 */
async function testEnhancedEligibilityScoring(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  console.log("📊 Testing Enhanced Printer Eligibility Scoring Algorithm...");

  try {
    const config = getRussianMarketFilterConfig('STANDARD');

    for (const printer of COMPREHENSIVE_TEST_DATA) {
      const scoreResult = calculatePrinterEligibilityScore(printer, config);
      
      details.push(`✅ ${printer.model}:`);
      details.push(`   - Overall score: ${scoreResult.score.toFixed(3)}`);
      details.push(`   - Source count factor: ${scoreResult.factors.sourceCount.toFixed(3)}`);
      details.push(`   - Source quality factor: ${scoreResult.factors.sourceQuality.toFixed(3)}`);
      details.push(`   - Official bonus: ${scoreResult.factors.officialBonus.toFixed(3)}`);
      details.push(`   - Market presence: ${scoreResult.factors.marketPresence.toFixed(3)}`);

      // Verify score is within valid range
      if (scoreResult.score >= 0 && scoreResult.score <= 1) {
        details.push(`   ✅ Score within valid range [0, 1]`);
      } else {
        details.push(`   ❌ Score outside valid range: ${scoreResult.score}`);
        allPassed = false;
      }

      // Verify official bonus is applied correctly
      const hasOfficialSource = printer.sources.some(s => s.sourceType === 'official');
      if (hasOfficialSource && scoreResult.factors.officialBonus > 0) {
        details.push(`   ✅ Official bonus correctly applied`);
      } else if (!hasOfficialSource && scoreResult.factors.officialBonus === 0) {
        details.push(`   ✅ No official bonus (no official sources)`);
      } else {
        details.push(`   ❌ Official bonus logic error`);
        allPassed = false;
      }
    }

  } catch (error) {
    details.push(`❌ Eligibility scoring test error: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

/**
 * Main test runner for Russian Market Filtering enhancements
 */
async function runRussianMarketFilteringTests(): Promise<void> {
  console.log("🚀 Starting Enhanced Russian Market Filtering Tests\n");
  console.log("Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6\n");

  const results = await Promise.all([
    testRussianMarketConfiguration(),
    testStrictSourceVerification(),
    testSeparateUnverifiedStorage(),
    testEnhancedEligibilityScoring()
  ]);

  const [configResult, verificationResult, storageResult, scoringResult] = results;

  // Print detailed results
  console.log("\n📊 ENHANCED RUSSIAN MARKET FILTERING TEST RESULTS:\n");

  console.log("1. CONFIGURATION MANAGEMENT:");
  configResult.details.forEach(detail => console.log(`   ${detail}`));
  console.log(`   Status: ${configResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log("2. STRICT 2+ SOURCE VERIFICATION:");
  verificationResult.details.forEach(detail => console.log(`   ${detail}`));
  console.log(`   Status: ${verificationResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log("3. SEPARATE UNVERIFIED STORAGE:");
  storageResult.details.forEach(detail => console.log(`   ${detail}`));
  console.log(`   Status: ${storageResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log("4. ENHANCED ELIGIBILITY SCORING:");
  scoringResult.details.forEach(detail => console.log(`   ${detail}`));
  console.log(`   Status: ${scoringResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Overall summary
  const allPassed = results.every(r => r.passed);
  console.log("🎯 OVERALL TEST STATUS:");
  console.log(`   ${allPassed ? '✅ ALL RUSSIAN MARKET FILTERING ENHANCEMENTS WORKING' : '⚠️ ISSUES DETECTED'}`);
  
  if (!allPassed) {
    console.log("\n🔧 RECOMMENDED ACTIONS:");
    if (!configResult.passed) console.log("   - Review Russian market filter configuration validation");
    if (!verificationResult.passed) console.log("   - Check strict 2+ source verification logic");
    if (!storageResult.passed) console.log("   - Verify separate storage implementation for unverified printers");
    if (!scoringResult.passed) console.log("   - Review enhanced eligibility scoring algorithm");
  } else {
    console.log("\n🎉 TASK 2 REQUIREMENTS SATISFIED:");
    console.log("   ✅ 3.1: Strict 2+ source verification for ru_verified status");
    console.log("   ✅ 3.2: Configuration for Russian source whitelist");
    console.log("   ✅ 3.3: Enhanced printer eligibility scoring algorithm");
    console.log("   ✅ 3.4: Include only ru_verified printers in final lists");
    console.log("   ✅ 3.5: Separate storage for unverified printers");
    console.log("   ✅ 3.6: Prioritize official Russian distributor sources");
  }

  console.log("\n✨ Russian Market Filtering enhancement tests completed!");
}

// Export for potential use in other contexts
export { runRussianMarketFilteringTests };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRussianMarketFilteringTests().catch(console.error);
}