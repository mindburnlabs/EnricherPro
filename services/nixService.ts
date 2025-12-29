import { firecrawlScrape, firecrawlAgent } from './firecrawlService';

export interface NixPackagingInfo {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;

  // Enhanced metadata for tracking
  source_url?: string;
  mpn?: string;
  confidence?: number;
  raw_source_string?: string;
  extraction_timestamp?: string;
}

export class NixService {
  private static SITE_URL = 'site:nix.ru';

  /**
   * Search for a product on nix.ru and extract packaging info
   */
  async getPackagingInfo(model: string, brand?: string): Promise<NixPackagingInfo | null> {
    try {
      // 1. Search for the product using agent to find URL
      const query = `Find the nix.ru product page for ${brand || ''} ${model} consumable. Return JSON with key "url" pointing to the product page.`;
      const agentResult = await firecrawlAgent(query);

      let productUrl: string | undefined;
      // Extract URL from agent result (it varies based on schema, but let's assume agent returns structured answer if requested or we parse it)
      // For now, let's try to extract a URL from the string if it's a string, or object.
      if (agentResult && typeof agentResult === 'object' && agentResult.url) {
        productUrl = agentResult.url; // Ideal case
      } else if (agentResult && agentResult.answer) {
        // simplistic url extraction from text
        const match = agentResult.answer.match(/https?:\/\/[^\s]+/);
        if (match) productUrl = match[0];
      }

      if (!productUrl || !productUrl.includes('nix.ru')) {
        console.warn(`No nix.ru URL found for ${model}`);
        return null;
      }

      // 3. Scrape the page
      const pageData = await firecrawlScrape(productUrl);

      if (!pageData || !pageData.success || !pageData.data) return null;

      // 4. Parse dimensions and weight
      return this.parseDimensionsFromText(pageData.data.markdown || '', productUrl);

    } catch (error) {
      console.error('NixService error:', error);
      return null;
    }
  }

  private parseDimensionsFromText(text: string, url: string): NixPackagingInfo | null {
    // Look for patterns like "Размеры упаковки: 30 x 15 x 10 см" or similar
    // Nix.ru often format: "Размеры упаковки (измерено в НИКСе): 35.5 x 15.5 x 15.5 см"
    // Weight format: "Вес брутто (измерено в НИКСе): 1.2 кг"

    const dimensionsRegex = /Размеры упаковки.*?:?\s*([\d\.]+)\s*[xх]\s*([\d\.]+)\s*[xх]\s*([\d\.]+)\s*см/i;
    const weightRegex = /Вес брутто.*?:?\s*([\d\.]+)\s*кг/i;

    const dimMatch = text.match(dimensionsRegex);
    const weightMatch = text.match(weightRegex);

    if (!dimMatch && !weightMatch) return null; // No data found

    const result: NixPackagingInfo = {
      width_mm: null,
      height_mm: null,
      depth_mm: null,
      weight_g: null,
      source_url: url
    };

    if (dimMatch) {
      // Convert cm to mm
      const dims = [
        parseFloat(dimMatch[1]) * 10,
        parseFloat(dimMatch[2]) * 10,
        parseFloat(dimMatch[3]) * 10
      ].sort((a, b) => b - a); // Sort desc: Length > Width > Height usually, but order matters for logistics. 
      // Standardize: L x W x H. L is usually max. 
      // Let's just return sorted for consistency or map strictly if we know which is which. 
      // Nix usually outputs W x H x D order? It varies. Sorting is safest for "box size".

      result.width_mm = dims[1]; // Middle
      result.height_mm = dims[2]; // Smallest
      result.depth_mm = dims[0]; // Longest (Length)
    }

    if (weightMatch) {
      // Convert kg to g
      result.weight_g = Math.round(parseFloat(weightMatch[1]) * 1000);
    }

    return result;
  }
}

export const nixService = new NixService();

// Adapters for checkpoint-validation.ts
export const fetchNIXPackageData = async (brand: string, model: string): Promise<NixPackagingInfo | null> => {
  return nixService.getPackagingInfo(model, brand);
};

export const validatePackageDimensions = (info: NixPackagingInfo): { isValid: boolean; missingFields: string[] } => {
  const missingFields: string[] = [];
  if (!info.width_mm) missingFields.push('width_mm');
  if (!info.height_mm) missingFields.push('height_mm');
  if (!info.depth_mm) missingFields.push('depth_mm');
  if (!info.weight_g) missingFields.push('weight_g');

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

export const convertToStandardUnits = (info: any): NixPackagingInfo => {
  // Handle conversion from cm/kg if present (legacy support for tests)
  if (info.width_cm !== undefined || info.weight_kg !== undefined) {
    return {
      width_mm: info.width_cm ? info.width_cm * 10 : null,
      height_mm: info.height_cm ? info.height_cm * 10 : null,
      depth_mm: info.depth_cm ? info.depth_cm * 10 : null,
      weight_g: info.weight_kg ? info.weight_kg * 1000 : null,
      source_url: info.source_url,
      confidence: info.confidence
    };
  }
  // Already standardized
  return info as NixPackagingInfo;
};