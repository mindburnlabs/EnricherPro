
/**
 * Enhanced Russian Market Filtering Validation Test
 * Task 2: Strengthen Russian Market Filtering
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { describe, it, expect } from 'vitest';
import {
  filterPrintersForRussianMarket,
  verifyRussianMarketEligibility,
  calculatePrinterEligibilityScore
} from '../services/russianMarketFilter';

import {
  getRussianMarketFilterConfig,
  validateRussianMarketConfig,
  createCustomRussianMarketConfig,
  getRecommendedConfig
} from '../services/russianMarketConfig';

import { PrinterCompatibility } from '../types';

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

describe('Russian Market Filtering', () => {

  describe('Configuration Management', () => {
    it('should validate all default profiles', () => {
      const profiles = ['STRICT', 'STANDARD', 'LENIENT', 'ULTRA_STRICT'] as const;
      for (const profile of profiles) {
        const config = getRussianMarketFilterConfig(profile);
        const validation = validateRussianMarketConfig(config);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should validate custom configuration', () => {
      const customConfig = createCustomRussianMarketConfig(3, [], 0.3, 0.8);
      const validation = validateRussianMarketConfig(customConfig);
      expect(validation.isValid).toBe(true);
    });

    it('should provide recommended configs for use cases', () => {
      const useCases = ['production', 'development', 'testing', 'critical'] as const;
      for (const useCase of useCases) {
        const config = getRecommendedConfig(useCase);
        expect(config).toBeDefined();
        expect(config.minSourcesForVerification).toBeGreaterThan(0);
      }
    });
  });

  describe('Strict 2+ Source Verification', () => {
    const strictConfig = getRussianMarketFilterConfig('STRICT');

    it('should verify correct eligibility for all test data', () => {
      for (const printer of COMPREHENSIVE_TEST_DATA) {
        const verification = verifyRussianMarketEligibility(printer.model, printer.sources, strictConfig);

        const russianSourceCount = printer.sources.filter(source =>
          strictConfig.russianSources.some(ruSource =>
            ruSource.searchPatterns.some(pattern =>
              source.url.toLowerCase().includes(pattern.toLowerCase())
            )
          )
        ).length;

        if (russianSourceCount >= strictConfig.minSourcesForVerification) {
          expect(verification.eligibility).toBe('ru_verified');
        } else if (russianSourceCount > 0) {
          expect(verification.eligibility).toBe('ru_unknown');
        } else {
          expect(verification.eligibility).toBe('ru_rejected');
        }
      }
    });
  });

  describe('Separate Unverified Storage (Mock)', () => {
    it('should categorize printers correctly without overlap', () => {
      const config = getRussianMarketFilterConfig('STANDARD');
      const filterResult = filterPrintersForRussianMarket(COMPREHENSIVE_TEST_DATA, config);

      // Verify counts (approximate based on test data)
      expect(filterResult.ruVerified.length).toBeGreaterThanOrEqual(1);
      expect(filterResult.ruUnknown.length).toBeGreaterThanOrEqual(1);
      expect(filterResult.ruRejected.length).toBeGreaterThanOrEqual(1);

      // Verify no overlap
      const verifiedModels = new Set(filterResult.ruVerified.map(p => p.model));
      const unknownModels = new Set(filterResult.ruUnknown.map(p => p.model));
      const rejectedModels = new Set(filterResult.ruRejected.map(p => p.model));

      const hasOverlap =
        [...verifiedModels].some(m => unknownModels.has(m) || rejectedModels.has(m)) ||
        [...unknownModels].some(m => rejectedModels.has(m));

      expect(hasOverlap).toBe(false);

      // Verify total count
      const total = filterResult.ruVerified.length + filterResult.ruUnknown.length + filterResult.ruRejected.length;
      expect(total).toBe(COMPREHENSIVE_TEST_DATA.length);
    });
  });

  describe('Enhanced Eligibility Scoring', () => {
    it('should calculate valid scores for all items', () => {
      const config = getRussianMarketFilterConfig('STANDARD');
      for (const printer of COMPREHENSIVE_TEST_DATA) {
        const scoreResult = calculatePrinterEligibilityScore(printer, config);
        expect(scoreResult.score).toBeGreaterThanOrEqual(0);
        expect(scoreResult.score).toBeLessThanOrEqual(1);

        if (printer.sources.some(s => s.sourceType === 'official')) {
          expect(scoreResult.factors.officialBonus).toBeGreaterThan(0);
        }
      }
    });
  });

});