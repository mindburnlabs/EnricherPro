/**
 * Enhanced Russian Market Filter with comprehensive audit trail
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { PrinterCompatibility, RuMarketFilterConfig, DataSource } from '../types';
import { createAuditTrailEntry, createEvidenceSource } from './auditTrailService';

// Default configuration for Russian market filtering
const DEFAULT_RU_FILTER_CONFIG: RuMarketFilterConfig = {
  minSourcesForVerification: 2,
  russianSources: [
    {
      name: 'cartridge.ru',
      baseUrl: 'https://cartridge.ru',
      priority: 1,
      isOfficial: false,
      searchPatterns: ['cartridge.ru', 'картридж.ру']
    },
    {
      name: 'rashodnika.net',
      baseUrl: 'https://rashodnika.net',
      priority: 1,
      isOfficial: false,
      searchPatterns: ['rashodnika.net', 'расходника.нет']
    },
    {
      name: 'nix.ru',
      baseUrl: 'https://nix.ru',
      priority: 2,
      isOfficial: false,
      searchPatterns: ['nix.ru', 'никс.ру']
    },
    {
      name: 'onlinetrade.ru',
      baseUrl: 'https://onlinetrade.ru',
      priority: 1,
      isOfficial: false,
      searchPatterns: ['onlinetrade.ru', 'онлайнтрейд.ру']
    }
  ],
  officialDistributorBonus: 0.2,
  confidenceThreshold: 0.7
};

/**
 * Enhanced Russian market eligibility verification
 * Requirements: 3.1, 3.2 - Verify presence in Russian-language sources
 */
export function verifyRussianMarketEligibility(
  printerModel: string,
  sources: DataSource[],
  config: RuMarketFilterConfig = DEFAULT_RU_FILTER_CONFIG
): {
  eligibility: 'ru_verified' | 'ru_unknown' | 'ru_rejected';
  confidence: number;
  verificationSources: DataSource[];
  auditTrail: any[];
  reasoning: string;
} {
  const auditTrail: any[] = [];
  const verificationSources: DataSource[] = [];
  
  auditTrail.push(createAuditTrailEntry(
    'validation',
    'russianMarketFilter.verifyRussianMarketEligibility',
    `Starting Russian market verification for printer: ${printerModel}`,
    {
      dataFieldsAffected: ['ru_market_eligibility'],
      sourceUrls: sources.map(s => s.url)
    }
  ));

  // Find sources that match Russian market patterns
  const russianSources = sources.filter(source => {
    const isRussianSource = config.russianSources.some(ruSource => 
      ruSource.searchPatterns.some(pattern => 
        source.url.toLowerCase().includes(pattern.toLowerCase()) ||
        source.sourceType === 'compatibility_db' && ruSource.name.includes(source.url.split('.')[1])
      )
    );
    
    if (isRussianSource) {
      verificationSources.push(source);
      auditTrail.push(createAuditTrailEntry(
        'validation',
        'russianMarketFilter.verifyRussianMarketEligibility',
        `Identified Russian source: ${source.url} (type: ${source.sourceType})`,
        {
          dataFieldsAffected: ['ru_verification_sources'],
          sourceUrls: [source.url],
          confidenceImpact: source.confidence
        }
      ));
    }
    
    return isRussianSource;
  });

  // Calculate verification confidence
  let confidence = 0;
  let reasoning = '';

  if (russianSources.length === 0) {
    confidence = 0;
    reasoning = 'No Russian market sources found';
    auditTrail.push(createAuditTrailEntry(
      'validation',
      'russianMarketFilter.verifyRussianMarketEligibility',
      `No Russian sources found for ${printerModel}`,
      {
        dataFieldsAffected: ['ru_market_eligibility'],
        confidenceImpact: 0
      }
    ));
  } else if (russianSources.length >= config.minSourcesForVerification) {
    // Calculate weighted confidence based on source quality and count
    const totalConfidence = russianSources.reduce((sum, source) => sum + source.confidence, 0);
    const avgConfidence = totalConfidence / russianSources.length;
    
    // Bonus for multiple sources
    const multiSourceBonus = Math.min(0.2, (russianSources.length - 1) * 0.1);
    
    // Bonus for official distributors
    const officialBonus = russianSources.some(s => s.sourceType === 'official') ? config.officialDistributorBonus : 0;
    
    confidence = Math.min(1.0, avgConfidence + multiSourceBonus + officialBonus);
    reasoning = `Verified in ${russianSources.length} Russian sources with average confidence ${avgConfidence.toFixed(2)}`;
    
    auditTrail.push(createAuditTrailEntry(
      'validation',
      'russianMarketFilter.verifyRussianMarketEligibility',
      `Russian market verification successful: ${russianSources.length} sources, confidence: ${confidence.toFixed(3)}`,
      {
        dataFieldsAffected: ['ru_market_eligibility'],
        sourceUrls: russianSources.map(s => s.url),
        confidenceImpact: confidence
      }
    ));
  } else {
    // Insufficient sources for full verification
    const totalConfidence = russianSources.reduce((sum, source) => sum + source.confidence, 0);
    confidence = Math.min(0.6, totalConfidence / russianSources.length); // Cap at 60% for insufficient sources
    reasoning = `Only ${russianSources.length} Russian source(s) found, below minimum of ${config.minSourcesForVerification}`;
    
    auditTrail.push(createAuditTrailEntry(
      'validation',
      'russianMarketFilter.verifyRussianMarketEligibility',
      `Insufficient Russian sources: ${russianSources.length} < ${config.minSourcesForVerification} required`,
      {
        dataFieldsAffected: ['ru_market_eligibility'],
        sourceUrls: russianSources.map(s => s.url),
        confidenceImpact: confidence
      }
    ));
  }

  // Determine final eligibility
  let eligibility: 'ru_verified' | 'ru_unknown' | 'ru_rejected';
  
  if (confidence >= config.confidenceThreshold && russianSources.length >= config.minSourcesForVerification) {
    eligibility = 'ru_verified';
  } else if (russianSources.length > 0) {
    eligibility = 'ru_unknown';
  } else {
    eligibility = 'ru_rejected';
  }

  auditTrail.push(createAuditTrailEntry(
    'validation',
    'russianMarketFilter.verifyRussianMarketEligibility',
    `Final eligibility determination: ${eligibility} (confidence: ${confidence.toFixed(3)})`,
    {
      dataFieldsAffected: ['ru_market_eligibility'],
      confidenceImpact: confidence
    }
  ));

  return {
    eligibility,
    confidence,
    verificationSources,
    auditTrail,
    reasoning
  };
}

/**
 * Enhanced printer compatibility filtering for Russian market
 * Requirements: 3.4, 3.5 - Include only ru_verified printers in final lists
 */
export function filterPrintersForRussianMarket(
  printers: PrinterCompatibility[],
  config: RuMarketFilterConfig = DEFAULT_RU_FILTER_CONFIG
): {
  ruVerified: PrinterCompatibility[];
  ruUnknown: PrinterCompatibility[];
  ruRejected: PrinterCompatibility[];
  auditTrail: any[];
  qualityMetrics: {
    totalProcessed: number;
    verifiedCount: number;
    unknownCount: number;
    rejectedCount: number;
    averageConfidence: number;
  };
} {
  const auditTrail: any[] = [];
  const ruVerified: PrinterCompatibility[] = [];
  const ruUnknown: PrinterCompatibility[] = [];
  const ruRejected: PrinterCompatibility[] = [];

  auditTrail.push(createAuditTrailEntry(
    'validation',
    'russianMarketFilter.filterPrintersForRussianMarket',
    `Starting Russian market filtering for ${printers.length} printers`,
    {
      dataFieldsAffected: ['compatible_printers_ru', 'compatible_printers_unverified'],
    }
  ));

  let totalConfidence = 0;

  printers.forEach(printer => {
    const verification = verifyRussianMarketEligibility(printer.model, printer.sources, config);
    
    // Update printer with verification results
    const enhancedPrinter: PrinterCompatibility = {
      ...printer,
      ruMarketEligibility: verification.eligibility
    };

    // Add verification audit trail
    auditTrail.push(...verification.auditTrail);
    totalConfidence += verification.confidence;

    // Categorize printer based on eligibility
    switch (verification.eligibility) {
      case 'ru_verified':
        ruVerified.push(enhancedPrinter);
        break;
      case 'ru_unknown':
        ruUnknown.push(enhancedPrinter);
        break;
      case 'ru_rejected':
        ruRejected.push(enhancedPrinter);
        break;
    }
  });

  const qualityMetrics = {
    totalProcessed: printers.length,
    verifiedCount: ruVerified.length,
    unknownCount: ruUnknown.length,
    rejectedCount: ruRejected.length,
    averageConfidence: printers.length > 0 ? totalConfidence / printers.length : 0
  };

  auditTrail.push(createAuditTrailEntry(
    'validation',
    'russianMarketFilter.filterPrintersForRussianMarket',
    `Russian market filtering completed: ${ruVerified.length} verified, ${ruUnknown.length} unknown, ${ruRejected.length} rejected`,
    {
      dataFieldsAffected: ['compatible_printers_ru', 'compatible_printers_unverified'],
      confidenceImpact: qualityMetrics.averageConfidence
    }
  ));

  return {
    ruVerified,
    ruUnknown,
    ruRejected,
    auditTrail,
    qualityMetrics
  };
}

/**
 * Enhanced printer eligibility scoring algorithm
 * Requirements: 3.3 - Enhance printer eligibility scoring algorithm
 */
export function calculatePrinterEligibilityScore(
  printer: PrinterCompatibility,
  config: RuMarketFilterConfig = DEFAULT_RU_FILTER_CONFIG
): {
  score: number;
  factors: {
    sourceCount: number;
    sourceQuality: number;
    officialBonus: number;
    marketPresence: number;
  };
  auditTrail: any[];
} {
  const auditTrail: any[] = [];
  
  auditTrail.push(createAuditTrailEntry(
    'validation',
    'russianMarketFilter.calculatePrinterEligibilityScore',
    `Calculating eligibility score for printer: ${printer.model}`,
    {
      dataFieldsAffected: ['printer_eligibility_score'],
      sourceUrls: printer.sources.map(s => s.url)
    }
  ));

  // Factor 1: Source count (more sources = higher confidence)
  const sourceCount = Math.min(1.0, printer.sources.length / 3); // Cap at 3 sources for full score
  
  // Factor 2: Source quality (average confidence of sources)
  const sourceQuality = printer.sources.length > 0 
    ? printer.sources.reduce((sum, source) => sum + source.confidence, 0) / printer.sources.length
    : 0;
  
  // Factor 3: Official distributor bonus
  const hasOfficialSource = printer.sources.some(s => s.sourceType === 'official');
  const officialBonus = hasOfficialSource ? config.officialDistributorBonus : 0;
  
  // Factor 4: Russian market presence (based on Russian sources)
  const russianSources = printer.sources.filter(source => 
    config.russianSources.some(ruSource => 
      ruSource.searchPatterns.some(pattern => 
        source.url.toLowerCase().includes(pattern.toLowerCase())
      )
    )
  );
  const marketPresence = Math.min(1.0, russianSources.length / config.minSourcesForVerification);

  // Calculate weighted score
  const score = Math.min(1.0, 
    sourceCount * 0.2 + 
    sourceQuality * 0.4 + 
    officialBonus + 
    marketPresence * 0.4
  );

  const factors = {
    sourceCount,
    sourceQuality,
    officialBonus,
    marketPresence
  };

  auditTrail.push(createAuditTrailEntry(
    'validation',
    'russianMarketFilter.calculatePrinterEligibilityScore',
    `Eligibility score calculated: ${score.toFixed(3)} (sources: ${sourceCount.toFixed(2)}, quality: ${sourceQuality.toFixed(2)}, official: ${officialBonus.toFixed(2)}, market: ${marketPresence.toFixed(2)})`,
    {
      dataFieldsAffected: ['printer_eligibility_score'],
      confidenceImpact: score
    }
  ));

  return {
    score,
    factors,
    auditTrail
  };
}