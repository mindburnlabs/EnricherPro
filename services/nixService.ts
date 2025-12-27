/**
 * NIX.ru Service Implementation
 * Exclusive sourcing for package dimensions and weight data with enhanced API integration
 * Requirements: 2.1, 2.2, 2.3
 */

import { firecrawlScrape } from './firecrawlService';
import { apiIntegrationService, createApiIntegrationError } from './apiIntegrationService';

export interface NIXPackageData {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
  mpn: string | null;
  raw_source_string: string;
  confidence: number;
  extraction_timestamp: string;
  source_url: string;
}

export interface NIXValidationResult {
  isValid: boolean;
  missingFields: string[];
  validationErrors: string[];
  confidence: number;
}

/**
 * Schema for extracting package data from NIX.ru
 */
const NIX_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    weight_g: { 
      type: 'number', 
      description: 'Package weight in grams. Extract from specifications or shipping info.' 
    },
    width_mm: { 
      type: 'number', 
      description: 'Package width in millimeters. Convert from cm if needed.' 
    },
    height_mm: { 
      type: 'number', 
      description: 'Package height in millimeters. Convert from cm if needed.' 
    },
    depth_mm: { 
      type: 'number', 
      description: 'Package depth/length in millimeters. Convert from cm if needed.' 
    },
    mpn: { 
      type: 'string', 
      description: 'Manufacturer Part Number or model number.' 
    },
    raw_dimensions_text: {
      type: 'string',
      description: 'Original text containing dimensions for verification'
    }
  },
  required: ['mpn']
};

/**
 * Converts various units to standardized mm/grams format
 * Requirements: 2.2 - Improve unit conversion accuracy
 */
export function convertToStandardUnits(data: any): {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
} {
  const result = {
    width_mm: null as number | null,
    height_mm: null as number | null,
    depth_mm: null as number | null,
    weight_g: null as number | null
  };

  // Convert dimensions to mm
  if (data.width_mm) {
    result.width_mm = Number(data.width_mm);
  } else if (data.width_cm) {
    result.width_mm = Number(data.width_cm) * 10;
  }

  if (data.height_mm) {
    result.height_mm = Number(data.height_mm);
  } else if (data.height_cm) {
    result.height_mm = Number(data.height_cm) * 10;
  }

  if (data.depth_mm) {
    result.depth_mm = Number(data.depth_mm);
  } else if (data.depth_cm) {
    result.depth_mm = Number(data.depth_cm) * 10;
  } else if (data.length_mm) {
    result.depth_mm = Number(data.length_mm);
  } else if (data.length_cm) {
    result.depth_mm = Number(data.length_cm) * 10;
  }

  // Convert weight to grams
  if (data.weight_g) {
    result.weight_g = Number(data.weight_g);
  } else if (data.weight_kg) {
    result.weight_g = Number(data.weight_kg) * 1000;
  }

  return result;
}

/**
 * Validates required package dimensions according to business rules
 * Requirements: 2.3 - Add validation for required package dimensions
 */
export function validatePackageDimensions(data: NIXPackageData): NIXValidationResult {
  const missingFields: string[] = [];
  const validationErrors: string[] = [];
  let confidence = 1.0;

  // Check required fields
  if (!data.width_mm || data.width_mm <= 0) {
    missingFields.push('width_mm');
  }
  if (!data.height_mm || data.height_mm <= 0) {
    missingFields.push('height_mm');
  }
  if (!data.depth_mm || data.depth_mm <= 0) {
    missingFields.push('depth_mm');
  }
  if (!data.weight_g || data.weight_g <= 0) {
    missingFields.push('weight_g');
  }

  // Validate dimension ranges (reasonable limits for consumables)
  if (data.width_mm && (data.width_mm < 10 || data.width_mm > 1000)) {
    validationErrors.push(`Width ${data.width_mm}mm is outside reasonable range (10-1000mm)`);
    confidence *= 0.7;
  }
  if (data.height_mm && (data.height_mm < 10 || data.height_mm > 1000)) {
    validationErrors.push(`Height ${data.height_mm}mm is outside reasonable range (10-1000mm)`);
    confidence *= 0.7;
  }
  if (data.depth_mm && (data.depth_mm < 10 || data.depth_mm > 1000)) {
    validationErrors.push(`Depth ${data.depth_mm}mm is outside reasonable range (10-1000mm)`);
    confidence *= 0.7;
  }
  if (data.weight_g && (data.weight_g < 10 || data.weight_g > 10000)) {
    validationErrors.push(`Weight ${data.weight_g}g is outside reasonable range (10-10000g)`);
    confidence *= 0.7;
  }

  // Check for suspicious values (all dimensions the same, etc.)
  if (data.width_mm && data.height_mm && data.depth_mm) {
    if (data.width_mm === data.height_mm && data.height_mm === data.depth_mm) {
      validationErrors.push('All dimensions are identical, which is suspicious');
      confidence *= 0.5;
    }
  }

  return {
    isValid: missingFields.length === 0 && validationErrors.length === 0,
    missingFields,
    validationErrors,
    confidence
  };
}

/**
 * Searches for product on NIX.ru and extracts package data
 * Requirements: 2.1 - Strengthen NIX.ru exclusive sourcing
 */
export async function fetchNIXPackageData(
  model: string, 
  brand: string
): Promise<NIXPackageData | null> {
  try {
    // Construct search query for NIX.ru
    const searchQuery = `${brand} ${model}`.trim();
    const nixSearchUrl = `https://nix.ru/search/?q=${encodeURIComponent(searchQuery)}`;
    
    // First, try to find the product page
    const searchResult = await firecrawlScrape(
      nixSearchUrl,
      `Find the product page for ${searchQuery} consumable and extract the direct product URL`,
      {
        type: 'object',
        properties: {
          product_url: { type: 'string', description: 'Direct URL to the product page' },
          found: { type: 'boolean', description: 'Whether the product was found' }
        }
      }
    );

    if (!searchResult.success || !searchResult.data.json?.found) {
      console.warn(`NIX.ru search failed for ${searchQuery}`);
      return null;
    }

    const productUrl = searchResult.data.json.product_url;
    if (!productUrl || !productUrl.includes('nix.ru')) {
      console.warn(`Invalid product URL from NIX.ru: ${productUrl}`);
      return null;
    }

    // Extract package data from the product page
    const extractResult = await firecrawlScrape(
      productUrl,
      `Extract package dimensions and weight for this printer consumable. Look for specifications, shipping info, or technical details.`,
      NIX_EXTRACTION_SCHEMA
    );

    if (!extractResult.success || !extractResult.data.json) {
      console.warn(`Failed to extract data from NIX.ru product page: ${productUrl}`);
      return null;
    }

    const rawData = extractResult.data.json;
    
    // Convert units to standard format
    const convertedData = convertToStandardUnits(rawData);
    
    // Create NIX package data object
    const nixData: NIXPackageData = {
      ...convertedData,
      mpn: rawData.mpn || null,
      raw_source_string: rawData.raw_dimensions_text || JSON.stringify(rawData),
      confidence: 0.9, // High confidence for NIX.ru data
      extraction_timestamp: new Date().toISOString(),
      source_url: productUrl
    };

    // Validate the extracted data
    const validation = validatePackageDimensions(nixData);
    nixData.confidence = validation.confidence;

    if (!validation.isValid) {
      console.warn(`NIX.ru data validation failed for ${searchQuery}:`, validation);
      // Still return the data but with lower confidence
      nixData.confidence *= 0.5;
    }

    return nixData;

  } catch (error) {
    console.error(`Error fetching NIX.ru data for ${brand} ${model}:`, error);
    return null;
  }
}

/**
 * Fallback handling when NIX data is unavailable
 * Requirements: 2.3 - Implement fallback handling when NIX data unavailable
 */
export function createFallbackPackageData(
  model: string,
  brand: string,
  reason: string
): NIXPackageData {
  return {
    width_mm: null,
    height_mm: null,
    depth_mm: null,
    weight_g: null,
    mpn: model,
    raw_source_string: `Fallback data - NIX.ru unavailable: ${reason}`,
    confidence: 0.0,
    extraction_timestamp: new Date().toISOString(),
    source_url: 'https://nix.ru'
  };
}

/**
 * Validates that package data comes exclusively from NIX.ru
 * Requirements: 2.1 - Ensure exclusive sourcing
 */
export function validateNIXExclusivity(sourceUrl: string): boolean {
  return sourceUrl.includes('nix.ru');
}

/**
 * Enhanced NIX.ru integration with retry logic, error handling, and optimized API integration
 */
export async function fetchNIXPackageDataWithRetry(
  model: string,
  brand: string,
  maxRetries: number = 3
): Promise<NIXPackageData> {
  let lastError: Error | null = null;
  
  // Use the API integration service for optimized retry handling
  try {
    const response = await apiIntegrationService.makeRequest(
      {
        serviceId: 'nix',
        operation: 'fetchPackageData',
        priority: 'medium',
        retryable: true,
        metadata: { model, brand }
      },
      async () => {
        const result = await fetchNIXPackageData(model, brand);
        
        return {
          success: result !== null,
          data: result,
          error: result === null ? 'Product not found on NIX.ru' : undefined,
          responseTime: 0
        };
      }
    );

    if (response.success && response.data) {
      return response.data;
    }
    
    // If no result but no error, treat as "not found"
    lastError = new Error(response.error || `Product not found on NIX.ru`);
    
  } catch (error) {
    lastError = error as Error;
    console.warn(`NIX.ru fetch failed:`, error);
  }
  
  // Return fallback data with error information
  return createFallbackPackageData(
    model,
    brand,
    lastError?.message || 'Unknown error after optimized retry attempts'
  );
}