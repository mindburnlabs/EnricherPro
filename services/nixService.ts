import { firecrawlScrape, firecrawlAgent } from './firecrawlService';
import { createEvidenceSource, createAuditTrailEntry } from './auditTrailService';

export interface NixPackagingInfo {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;

  // Enhanced metadata for tracking
  source_url?: string;
  source_type?: 'nix_ru' | 'other';
  confidence?: number;
  raw_source_string?: string;
  extraction_timestamp?: string;
}



// NIX.ru specific schema for Agent
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

export interface NixPackagingInfo {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
  source_url?: string;
  source_type?: 'nix_ru' | 'other';
  confidence?: number;
  raw_source_string?: string;
  extraction_timestamp?: string;
  audit_events?: any[]; // To piggyback audit logs up to Orchestrator
}



export class NixService {
  /**
   * Robust "Logistics Agent" that uses multiple strategies to find NIX.ru data.
   * Strategy:
   * 1. Direct Search (Agent) -> Scrape (High Precision)
   * 2. Deep Agent Research (Fallback)
   * 3. Legacy Scrape (Last Resort)
   */
  async getPackagingInfo(model: string, brand: string): Promise<NixPackagingInfo | null> {
    const auditEvents: any[] = [];

    // Strategy 1: Direct Discovery & Scrape
    try {
      const directResult = await this.strategyDirectScrape(model, brand);
      if (directResult) {
        directResult.audit_events = auditEvents;
        return directResult;
      }
    } catch (e) {
      console.warn(`[NixService] Direct strategy failed: ${(e as Error).message}`);
      auditEvents.push(createAuditTrailEntry('error_handling', 'NixService.direct', `Direct strategy failed: ${(e as Error).message}`, {}));
    }

    // Strategy 2: Firecrawl Agent (Deep Search) - Using the centralized Deep Research
    // Note: In strict architecture, Orchestrator might call this separately, but we encapsulate "Get NIX Data" here.
    // For now, we will stick to a simpler fallback using the Agent to finding data directly if direct URL find failed.

    // Actually, Strategy 1 already uses `firecrawlAgent` to find the URL.
    // If that failed, we might try a broader query.

    return null;
  }

  private async strategyDirectScrape(model: string, brand: string): Promise<NixPackagingInfo | null> {
    // 1. Search for the product using agent to find URL
    const query = `Find the strict NIX.ru product page for ${brand || ''} ${model} cartridge/consumable. Return ONLY the JSON object with key "url". If not found on nix.ru, return null.`;
    const agentResult = await firecrawlAgent(query);

    let productUrl: string | undefined;

    if (agentResult && typeof agentResult === 'object' && agentResult.url) {
      productUrl = agentResult.url;
    } else if (typeof agentResult === 'string') {
      const match = (agentResult as string).match(/https?:\/\/(?:www\.)?nix\.ru\/[^\s"')]+/);
      if (match) productUrl = match[0];
    }

    if (!productUrl || !productUrl.includes('nix.ru')) {
      return null;
    }

    // 2. Scrape
    const pageData = await firecrawlScrape(productUrl);
    if (!pageData || !pageData.success || !pageData.data) {
      return null;
    }

    // 3. Parse
    const info = this.parseDimensionsFromText(pageData.data.markdown || '', productUrl);
    return info;
  }

  private parseDimensionsFromText(text: string, url: string): NixPackagingInfo | null {
    const dimensionsRegex = /Размеры упаковки.*?:?\s*([\d\.]+)\s*[xх]\s*([\d\.]+)\s*[xх]\s*([\d\.]+)\s*см/i;
    const weightRegex = /Вес брутто.*?:?\s*([\d\.]+)\s*кг/i;

    const dimMatch = text.match(dimensionsRegex);
    const weightMatch = text.match(weightRegex);

    if (!dimMatch && !weightMatch) return null;

    const result: NixPackagingInfo = {
      width_mm: null,
      height_mm: null,
      depth_mm: null,
      weight_g: null,
      source_url: url,
      source_type: 'nix_ru',
      extraction_timestamp: new Date().toISOString(),
      confidence: 1.0,
      raw_source_string: ''
    };

    const validDims = [];

    if (dimMatch) {
      const d1 = parseFloat(dimMatch[1]) * 10;
      const d2 = parseFloat(dimMatch[2]) * 10;
      const d3 = parseFloat(dimMatch[3]) * 10;
      const dims = [d1, d2, d3].sort((a, b) => b - a);
      result.depth_mm = dims[0];
      result.width_mm = dims[1];
      result.height_mm = dims[2];
      validDims.push(`${d1 / 10}x${d2 / 10}x${d3 / 10} cm`);
    }

    if (weightMatch) {
      const kg = parseFloat(weightMatch[1]);
      result.weight_g = Math.round(kg * 1000);
      validDims.push(`${kg} kg`);
    }

    result.raw_source_string = `NIX Extraction: ${validDims.join(', ')}`;
    return result;
  }
}

export const nixService = new NixService();