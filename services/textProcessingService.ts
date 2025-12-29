/**
 * Text Processing Service for Consumable Enricher
 * Handles text normalization, parsing, and extraction according to Russian market requirements
 */

export interface ExtractionResult<T> {
  value: T;
  confidence: number;
  source: string;
}

export interface ModelExtractionResult {
  model: string;
  candidates: string[];
  confidence: number;
  extractionMethod: string;
}

export interface BrandDetectionResult {
  brand: string;
  confidence: number;
  detectionMethod: string;
}

export interface YieldExtractionResult {
  value: number;
  unit: 'pages' | 'copies' | 'ml';
  originalText: string;
  confidence: number;
}

export interface NormalizationLog {
  step: string;
  before: string;
  after: string;
  description: string;
}

/**
 * Normalizes consumable type based on keywords
 * Requirements: 2.3
 */
export function normalizeType(title: string): ExtractionResult<'toner_cartridge' | 'drum_unit' | 'ink_cartridge' | 'unknown'> {
  const lower = title.toLowerCase();

  // Drum Unit patterns (High priority)
  if (/(drum|драм|фотобарабан|копи-картридж|оптический блок|image unit|imaging unit)/i.test(lower)) {
    return { value: 'drum_unit', confidence: 0.95, source: 'keyword_match' };
  }

  // Toner Cartridge patterns
  if (/(toner|тонер|cartridge|картридж|laser|лазерный)/i.test(lower)) {
    // Distinguish waste toner if needed, but for now map to toner structure
    if (/waste|бункер/i.test(lower)) return { value: 'unknown', confidence: 0.8, source: 'waste_check' }; // Or 'waste_toner' if supported
    return { value: 'toner_cartridge', confidence: 0.9, source: 'keyword_match' };
  }

  // Ink patterns
  if (/(ink|чернила|струйный)/i.test(lower)) {
    return { value: 'ink_cartridge', confidence: 0.9, source: 'keyword_match' };
  }

  return { value: 'unknown', confidence: 0, source: 'default' };
}

/**
 * Normalizes color based on common abbreviations
 * Requirements: 2.4
 */
export function normalizeColor(title: string): ExtractionResult<string | null> {
  const lower = title.toLowerCase();

  if (/\b(black|bk|k|черный|чёрный)\b/i.test(lower)) return { value: 'Black', confidence: 0.95, source: 'keyword' };
  if (/\b(cyan|c|синий|голубой)\b/i.test(lower)) return { value: 'Cyan', confidence: 0.95, source: 'keyword' };
  if (/\b(magenta|m|purpur|пурпурный|магента)\b/i.test(lower)) return { value: 'Magenta', confidence: 0.95, source: 'keyword' };
  if (/\b(yellow|y|желтый|жёлтый)\b/i.test(lower)) return { value: 'Yellow', confidence: 0.95, source: 'keyword' };

  return { value: null, confidence: 0, source: 'default' };
}

/**
 * Extracts printer candidates from "for..." blocks
 * Requirements: 2.5
 */
export function extractPrinterCandidates(title: string): string[] {
  // Pattern: "for/для [Printers]"
  const forPattern = /\b(for|для|printers?|совместим с)\s+([a-z0-9\s\/\.,-]+)/i;
  const match = title.match(forPattern);

  if (!match) return [];

  const block = match[2];
  // Split by slashes, commas, or " and "
  return block.split(/[\/,]|\s+and\s+/).map(s => s.trim()).filter(s => s.length > 2);
}

/**
 * Normalizes Unicode characters and removes extra spaces
 * Requirements: 1.1
 */
export function normalizeTitle(title: string): { normalized: string; log: NormalizationLog[] } {
  const log: NormalizationLog[] = [];
  let result = title;

  // Step 1: Unicode normalization (NFC - Canonical Decomposition followed by Canonical Composition)
  const beforeUnicode = result;
  result = result.normalize('NFC');
  if (beforeUnicode !== result) {
    log.push({
      step: 'unicode_normalization',
      before: beforeUnicode,
      after: result,
      description: 'Applied Unicode NFC normalization'
    });
  }

  // Step 2: Remove extra spaces and normalize whitespace
  const beforeSpaces = result;
  result = result.replace(/\s+/g, ' ').trim();
  if (beforeSpaces !== result) {
    log.push({
      step: 'whitespace_normalization',
      before: beforeSpaces,
      after: result,
      description: 'Removed extra spaces and normalized whitespace'
    });
  }

  // Step 3: Standardize common separators
  const beforeSeparators = result;
  result = result.replace(/[–—]/g, '-'); // Replace em/en dashes with hyphens
  result = result.replace(/[""]/g, '"'); // Normalize quotes
  result = result.replace(/['']/g, "'"); // Normalize apostrophes
  if (beforeSeparators !== result) {
    log.push({
      step: 'separator_normalization',
      before: beforeSeparators,
      after: result,
      description: 'Standardized separators and quotes'
    });
  }

  return { normalized: result, log };
}

/**
 * Converts yield notations to standardized numeric format
 * Requirements: 1.4 - Convert 15K→15000, 300К→300000 (note Cyrillic К)
 */
export function standardizeYieldNotation(text: string): { converted: string; extractions: YieldExtractionResult[] } {
  const extractions: YieldExtractionResult[] = [];
  let result = text;

  // Pattern for yield notation with K/К multipliers (including Cyrillic К U+041A)
  // Matches: 15K, 300К, 2.5K, 1,5К, etc.
  // Note: Removed \b word boundary as it doesn't work properly with Cyrillic characters
  const yieldPattern = /(\d+(?:[.,]\d+)?)\s*([K\u041A])(?=\s|$)/gi;

  result = result.replace(yieldPattern, (match, number, multiplier) => {
    // Convert comma decimal separator to dot
    const normalizedNumber = number.replace(',', '.');
    const numValue = parseFloat(normalizedNumber);
    const convertedValue = numValue * 1000;

    extractions.push({
      value: convertedValue,
      unit: 'pages', // Default assumption for K notation
      originalText: match,
      confidence: 0.9
    });

    return convertedValue.toString();
  });

  // Pattern for explicit page/copy yields (including Russian terms)
  const explicitYieldPattern = /(\d+(?:[.,]\d+)?)\s*(pages?|copies?|страниц|жизней|стр\.?|копий|мл|ml)(?=\s|$|[.,!])/gi;

  result.replace(explicitYieldPattern, (match, number, unit) => {
    const normalizedNumber = number.replace(',', '.');
    const numValue = parseFloat(normalizedNumber);

    let standardUnit: 'pages' | 'copies' | 'ml' = 'pages';
    if (unit.toLowerCase().includes('cop') || unit.includes('копий')) {
      standardUnit = 'copies';
    } else if (unit.toLowerCase().includes('ml') || unit.includes('мл')) {
      standardUnit = 'ml';
    }

    extractions.push({
      value: numValue,
      unit: standardUnit,
      originalText: match,
      confidence: 0.95
    });

    return match; // Don't replace explicit yields, just extract them
  });

  return { converted: result, extractions };
}

/**
 * Enhanced model pattern recognition for consumable models
 * Requirements: 1.5 - Extract models using letter+number patterns
 */
export function extractConsumableModel(title: string): ModelExtractionResult {
  const candidates: { model: string; method: string; priority: number; position: number }[] = [];

  // Pattern 1: Brother/Kyocera format like TN-1150, DR-3400, DK-7105 (highest priority for consumables)
  const brotherKyoceraPattern = /\b([A-Z]{2}[-]\d{4,5})\b/g;
  let match;
  while ((match = brotherKyoceraPattern.exec(title)) !== null) {
    candidates.push({
      model: match[1],
      method: 'brother_kyocera_pattern',
      priority: 1,
      position: match.index
    });
  }

  // Pattern 2: Canon format like CRG-045, PGI-580, CLI-581
  const canonPattern = /\b([A-Z]{3}[-]\d{3}[A-Z]?)\b/g;
  while ((match = canonPattern.exec(title)) !== null) {
    candidates.push({
      model: match[1],
      method: 'canon_pattern',
      priority: 2,
      position: match.index
    });
  }

  // Pattern 3: HP/Standard format like CF234A, Q2612A
  const hpStandardPattern = /\b([A-Z]{1,2}\d{3,5}[A-Z]?)\b/g;
  while ((match = hpStandardPattern.exec(title)) !== null) {
    candidates.push({
      model: match[1],
      method: 'hp_standard_pattern',
      priority: 3,
      position: match.index
    });
  }

  // Pattern 4: Epson format like T0711, 16XL, 603XL
  const epsonPattern = /\b([T]\d{4}|\d{2,3}XL?)\b/g;
  while ((match = epsonPattern.exec(title)) !== null) {
    candidates.push({
      model: match[1],
      method: 'epson_pattern',
      priority: 4,
      position: match.index
    });
  }

  // Pattern 5: Xerox format like 106R03623
  const xeroxPattern = /\b(\d{3}R\d{5})\b/g;
  while ((match = xeroxPattern.exec(title)) !== null) {
    candidates.push({
      model: match[1],
      method: 'xerox_pattern',
      priority: 5,
      position: match.index
    });
  }

  // Pattern 6: Generic alphanumeric with specific length (lowest priority)
  const genericPattern = /\b([A-Z]\d{4,6}[A-Z]?|\d{3,4}[A-Z]{1,2})\b/g;
  while ((match = genericPattern.exec(title)) !== null) {
    // Only add if not already found by more specific patterns
    const modelExists = candidates.some(c => c.model === match[1]);
    if (!modelExists && match[1].length >= 4) {
      candidates.push({
        model: match[1],
        method: 'generic_pattern',
        priority: 10,
        position: match.index
      });
    }
  }

  // Select the best model based on priority, then position (earlier in title is better)
  let selectedModel = '';
  let confidence = 0;
  let extractionMethod = '';
  const allCandidates = candidates.map(c => c.model);

  if (candidates.length > 0) {
    // Sort by priority (lower number = higher priority), then by position (earlier = better)
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.position - b.position;
    });

    const best = candidates[0];
    selectedModel = best.model;
    extractionMethod = best.method;

    // Set confidence based on method and number of candidates
    switch (best.method) {
      case 'brother_kyocera_pattern':
      case 'canon_pattern':
      case 'hp_standard_pattern':
        confidence = 0.9;
        break;
      case 'epson_pattern':
      case 'xerox_pattern':
        confidence = 0.85;
        break;
      case 'generic_pattern':
        confidence = 0.7;
        break;
      default:
        confidence = 0.8;
    }

    // Reduce confidence if multiple candidates found
    if (candidates.length > 1) {
      confidence = Math.max(confidence * 0.9, 0.6);
    }
  }

  return {
    model: selectedModel,
    candidates: allCandidates,
    confidence,
    extractionMethod
  };
}

/**
 * Enhanced brand detection with expanded pattern matching
 * Requirements: 1.6, 1.7, 1.8 - Identify brands from title text or model prefix patterns
 */
export function detectBrand(title: string, model?: string): BrandDetectionResult {
  const titleLower = title.toLowerCase();
  let detectedBrand = '';
  let confidence = 0;
  let method = '';

  // Brand patterns with aliases and variations
  const brandPatterns = {
    'HP': {
      patterns: [/\bhp\b/i, /hewlett[- ]?packard/i],
      modelPrefixes: ['CF', 'CE', 'CC', 'CB', 'Q', 'C9', 'C8', 'C7', 'W1', 'W2'],
      confidence: 0.95
    },
    'Canon': {
      patterns: [/\bcanon\b/i],
      modelPrefixes: ['CRG', 'PGI', 'CLI', 'BCI', 'PFI'],
      confidence: 0.95
    },
    'Brother': {
      patterns: [/\bbrother\b/i],
      modelPrefixes: ['TN', 'DR', 'LC'],
      confidence: 0.95
    },
    'Kyocera': {
      patterns: [/\bkyocera\b/i, /\bmita\b/i],
      modelPrefixes: ['TK', 'DK', 'MK'],
      confidence: 0.95
    },
    'Epson': {
      patterns: [/\bepson\b/i],
      modelPrefixes: ['T0', 'T1', 'T2', 'T3', 'C13'],
      confidence: 0.95
    },
    'Samsung': {
      patterns: [/\bsamsung\b/i],
      modelPrefixes: ['MLT', 'CLT', 'SCX'],
      confidence: 0.95
    },
    'Xerox': {
      patterns: [/\bxerox\b/i],
      modelPrefixes: ['106R', '108R', '113R'],
      confidence: 0.95
    },
    'Lexmark': {
      patterns: [/\blexmark\b/i],
      modelPrefixes: ['C5', 'E5', 'X5', '24', '25', '26', '27'],
      confidence: 0.95
    },
    'OKI': {
      patterns: [/\boki\b/i, /\bokidata\b/i],
      modelPrefixes: ['44', '45', '46', '47'],
      confidence: 0.95
    },
    'Ricoh': {
      patterns: [/\bricoh\b/i],
      modelPrefixes: ['SP', 'MP', 'TYPE'],
      confidence: 0.95
    }
  };

  // Method 1: Direct brand name detection in title
  for (const [brand, config] of Object.entries(brandPatterns)) {
    for (const pattern of config.patterns) {
      if (pattern.test(titleLower)) {
        detectedBrand = brand;
        confidence = config.confidence;
        method = 'title_text_match';
        break;
      }
    }
    if (detectedBrand) break;
  }

  // Method 2: Model prefix pattern matching
  if (!detectedBrand && model) {
    for (const [brand, config] of Object.entries(brandPatterns)) {
      for (const prefix of config.modelPrefixes) {
        if (model.toUpperCase().startsWith(prefix)) {
          detectedBrand = brand;
          confidence = config.confidence * 0.9; // Slightly lower confidence for prefix matching
          method = 'model_prefix_match';
          break;
        }
      }
      if (detectedBrand) break;
    }
  }

  // Method 3: Context-based detection (common model patterns)
  if (!detectedBrand) {
    // HP-specific patterns
    if (/\b(laserjet|deskjet|officejet|pagewide)\b/i.test(titleLower)) {
      detectedBrand = 'HP';
      confidence = 0.8;
      method = 'context_pattern';
    }
    // Canon-specific patterns
    else if (/\b(pixma|imageclass|maxify)\b/i.test(titleLower)) {
      detectedBrand = 'Canon';
      confidence = 0.8;
      method = 'context_pattern';
    }
    // Brother-specific patterns
    else if (/\b(mfc|dcp|hl)\b/i.test(titleLower)) {
      detectedBrand = 'Brother';
      confidence = 0.8;
      method = 'context_pattern';
    }
  }

  return {
    brand: detectedBrand,
    confidence,
    detectionMethod: method
  };
}

/**
 * Comprehensive text processing pipeline
 * Combines all processing steps with logging
 */
export function processSupplierTitle(title: string): {
  normalized: string;
  model: ModelExtractionResult;
  brand: BrandDetectionResult;
  yieldInfo: YieldExtractionResult[];
  detectedType: ExtractionResult<'toner_cartridge' | 'drum_unit' | 'ink_cartridge' | 'unknown'>;
  detectedColor: ExtractionResult<string | null>;
  printerCandidates: string[];
  normalizationLog: NormalizationLog[];
} {
  // Step 1: Normalize title
  const { normalized, log } = normalizeTitle(title);

  // Step 2: Standardize yield notation
  const { converted, extractions } = standardizeYieldNotation(normalized);

  // Step 3: Extract model
  const modelResult = extractConsumableModel(converted);

  // Step 4: Detect brand
  const brandResult = detectBrand(converted, modelResult.model);

  // Step 5: Detect type and color
  const typeResult = normalizeType(converted);
  const colorResult = normalizeColor(converted);
  const printerCandidates = extractPrinterCandidates(converted);

  return {
    normalized: converted,
    model: modelResult,
    brand: brandResult,
    yieldInfo: extractions,
    detectedType: typeResult,
    detectedColor: colorResult,
    printerCandidates,
    normalizationLog: log
  };
}