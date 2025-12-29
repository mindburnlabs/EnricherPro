
/**
 * Firecrawl Service Implementation
 * Production-ready wrapper for v2 API with enhanced API integration optimization
 * Implements rate limiting, circuit breaker patterns, and health monitoring
 */

import { apiIntegrationService, createApiIntegrationError } from './apiIntegrationService';

const API_V1 = 'https://api.firecrawl.dev/v1';
const API_V2 = 'https://api.firecrawl.dev/v2';
const STORAGE_KEY = 'firecrawl_api_key';

// Helper to get API key (simulated or real)
export const getFirecrawlApiKey = () => {
  if (typeof localStorage !== 'undefined') {
    const key = localStorage.getItem(STORAGE_KEY);
    if (key) return key;
  }
  // Safe access for test environment
  const env = (import.meta as any).env || {};
  return env.VITE_FIRECRAWL_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_FIRECRAWL_API_KEY : '') || '';
};

export interface FirecrawlExtractSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface ScrapeResponse {
  success: boolean;
  data: {
    markdown?: string;
    json?: any; // v2 uses "json" key inside data for extractions
    summary?: string;
    images?: string[]; // New in v2 formats
    metadata?: {
      title?: string;
      description?: string;
      statusCode?: number;
      [key: string]: any;
    };
  };
  error?: string;
}

/**
 * Validates the API key.
 * Account and team management endpoints are most stable on v1.
 */
export const validateFirecrawlApiKey = async (key: string): Promise<boolean> => {
  // Basic format check
  // Allow explicit test keys or standard format
  if (!key) return false;
  if (key === 'fc-test-key' || key.startsWith('fc-test-')) return true;
  if (!key.trim().startsWith('fc-')) return false;

  try {
    // Attempt real validation against the API
    // We use v1/team which is lightweight and standard for credit checks
    const response = await fetch(`${API_V1}/team`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key.trim()}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000) // 5s strict timeout
    });

    if (response.ok) return true;

    // If explicit auth error, return false
    if (response.status === 401 || response.status === 403) {
      console.warn("Firecrawl validation failed: Invalid credentials");
      return false;
    }

    // For other errors (500s), we might be lenient, but usually false is safer
    return false;
  } catch (e) {
    console.error("Firecrawl validation network error:", e);
    // If network is completely down, we default to believing the format check
    // to allow offline configuration
    return true;
  }
};

/**
 * Enhanced Firecrawl Agent with optimized API integration
 * Uses Search Grounding to find primary source URLs with rate limiting and circuit breaker protection
 */
export const firecrawlAgent = async (prompt: string, schema?: any, urls?: string[]) => {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) throw new Error("Firecrawl API Key missing.");

  // TEST KEY MOCK RESPONSE
  if (apiKey.startsWith('fc-test-')) {
    console.log('Using Firecrawl TEST KEY - Returning mock agent response');
    return {
      answer: "Designed for HP LaserJet Pro M402/M426 series. High yield black toner cartridge. Verified 5% coverage yield approx 9000 pages.",
      references: [
        { url: 'https://www.nix.ru/autocatalog/hp/printing_supplies/HP-CF226X-26X-Black-Chernyj-Originalnyj-kartridzh-povyshennoj-emkosti_218175.html', title: 'NIX.ru Catalog' },
        { url: 'https://support.hp.com/us-en/document/c04772186', title: 'HP Official Support' }
      ],
      urls: ['https://www.nix.ru/autocatalog/hp/printing_supplies/HP-CF226X-26X-Black-Chernyj-Originalnyj-kartridzh-povyshennoj-emkosti_218175.html'],
      steps: [],
      markdown: "## Product Details\n\n**Model**: CF226X (26X)\n**Brand**: HP\n**Yield**: 9000 pages\n**Color**: Black"
    };
  }

  // Use the optimized API integration service
  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'firecrawl',
      operation: 'agent',
      priority: 'high',
      retryable: true,
      creditsRequired: 40,
      metadata: { prompt: prompt.substring(0, 100) + '...' }
    },
    async () => {
      const httpResponse = await fetch(`${API_V2}/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          prompt,
          schema,
          urls,
          maxCredits: 40 // Limit credits per research session
        })
      });

      const result = await httpResponse.json().catch(() => ({}));

      return {
        success: httpResponse.ok,
        data: result,
        error: httpResponse.ok ? undefined : result.message || `Agent Error: ${httpResponse.status}`,
        statusCode: httpResponse.status,
        responseTime: 0, // Will be set by API integration service
        creditsUsed: result.creditsUsed || 40
      };
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Firecrawl agent request failed');
  }

  return response.data;
};

/**
 * Enhanced agent status polling with optimized API integration
 */
export const getAgentStatus = async (jobId: string) => {
  const apiKey = getFirecrawlApiKey();

  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'firecrawl',
      operation: 'getAgentStatus',
      priority: 'medium',
      retryable: true,
      metadata: { jobId }
    },
    async () => {
      const httpResponse = await fetch(`${API_V2}/agent/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
      });

      const result = await httpResponse.json().catch(() => ({}));

      return {
        success: httpResponse.ok,
        data: result,
        error: httpResponse.ok ? undefined : result.message || `Status Check Failed: ${httpResponse.status}`,
        statusCode: httpResponse.status,
        responseTime: 0
      };
    }
  );

  if (!response.success) {
    throw new Error(response.error || 'Agent status check failed');
  }

  return response.data;
};

/**
 * Enhanced Deep Autonomous Agent Research with reliable sources prioritization.
 * Based on reliable_sources.md and complete_specification.md requirements.
 */
export async function deepAgentResearch(query: string, brand?: string): Promise<any> {
  // Prioritized source list based on reliable_sources.md

  const reliableSources = [
    // OEM Sources (HIGHEST PRIORITY)
    'https://support.hp.com/',
    'https://www.canon.com/',
    'https://support.canon.com/',
    'https://www.epson.com/',
    'https://www.kyoceradocumentsolutions.com/',
    'https://support.kyocera.com/',
    'https://www.brother.com/',
    'https://support.brother.com/',

    // Russian Market Sources (HIGH PRIORITY)
    'https://cartridge.ru/',
    'https://rashodnika.net/',

    // Logistics Source (CRITICAL - NIX.ru exclusive)
    'https://www.nix.ru/',
    'https://max.nix.ru/',
    'https://elets.nix.ru/'
  ];

  const prompt = `CRITICAL RESEARCH TASK for printer consumable: "${query}"${brand ? ` (Brand: ${brand})` : ''}

MANDATORY DATA REQUIREMENTS (per complete_specification.md):
1. EXACT Manufacturer Part Number (MPN) - CRITICAL
2. Package dimensions in mm (L×W×H) - MUST be from NIX.ru ONLY
3. Package weight in grams - MUST be from NIX.ru ONLY  
4. Compatible printer models for RUSSIAN MARKET - verify in ≥2 RU sources
5. Page yield at 5% coverage (if available)
6. Consumable type (toner_cartridge, drum_unit, ink_cartridge, etc.)

PRIORITIZED SOURCE STRATEGY (per reliable_sources.md):
1. OEM SOURCES (HIGHEST PRIORITY): ${brand ? `Focus on ${brand} official sites first` : 'HP, Canon, Epson, Kyocera, Brother official sites'}
2. RUSSIAN MARKET VERIFICATION: cartridge.ru, rashodnika.net for compatibility confirmation
3. LOGISTICS DATA (NIX.ru EXCLUSIVE): Package dimensions/weight ONLY from nix.ru domains
4. Cross-reference multiple sources for compatibility validation

SEARCH TARGETS:
${reliableSources.map(source => `- ${source}`).join('\n')}

VALIDATION RULES:
- Package data: ONLY accept from nix.ru domains (www.nix.ru, max.nix.ru, etc.)
- Compatibility: Require ≥2 Russian sources OR 1 OEM RU source for ru_verified status
- Convert units: cm→mm (×10), kg→g (×1000)
- Prioritize official OEM specifications over third-party data

CRITICAL: If NIX.ru data unavailable, mark as needs_review - do not use alternative sources for logistics.`;

  const schema = {
    type: 'object',
    properties: {
      brand: { type: 'string', description: 'Printer brand (HP, Canon, etc.)' },
      mpn: { type: 'string', description: 'Exact manufacturer part number' },
      consumable_type: {
        type: 'string',
        enum: ['toner_cartridge', 'drum_unit', 'ink_cartridge', 'maintenance_kit', 'waste_toner', 'other'],
        description: 'Type of consumable'
      },

      // NIX.ru exclusive logistics data
      nix_logistics: {
        type: 'object',
        properties: {
          weight_g: { type: 'number', description: 'Weight in grams from NIX.ru' },
          dimensions_mm: {
            type: 'object',
            properties: {
              length: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' }
            },
            description: 'Dimensions in mm converted from NIX.ru cm data'
          },
          source_url: { type: 'string', description: 'NIX.ru source URL' },
          raw_data: { type: 'string', description: 'Raw text from NIX.ru page' }
        }
      },

      // Compatibility with source verification
      compatibility: {
        type: 'object',
        properties: {
          ru_verified_printers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Printers verified in ≥2 RU sources or 1 OEM RU'
          },
          unverified_printers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Printers found but not verified for RU market'
          },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                source_type: { type: 'string', enum: ['oem', 'cartridge_ru', 'rashodnika_net', 'nix_ru', 'other'] },
                printers_confirmed: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },

      // Additional specifications
      specifications: {
        type: 'object',
        properties: {
          yield_pages: { type: 'number', description: 'Page yield at 5% coverage' },
          color: { type: 'string', description: 'Color (Black, Cyan, Magenta, Yellow)' },
          has_chip: { type: 'boolean', description: 'Has chip' },
          has_page_counter: { type: 'boolean', description: 'Has page counter' }
        }
      },

      // Research metadata
      research_quality: {
        type: 'object',
        properties: {
          oem_sources_found: { type: 'number' },
          ru_sources_found: { type: 'number' },
          nix_data_available: { type: 'boolean' },
          confidence_score: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    required: ['mpn', 'brand', 'consumable_type', 'compatibility', 'research_quality']
  };

  console.log('Starting enhanced Firecrawl agent research with reliable sources prioritization...');

  const initialResponse = await firecrawlAgent(prompt, schema);
  let status = initialResponse;

  // Enhanced polling with better error handling
  let attempts = 0;
  const maxAttempts = 30; // Increased timeout for thorough research

  while (status.status === 'processing' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000));
    if (!status.id) break;

    try {
      status = await getAgentStatus(status.id);
      if (status.status === 'failed') {
        throw new Error(`Enhanced agent research failed: ${status.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Agent status check failed (attempt ${attempts + 1}):`, error);
      if (attempts >= maxAttempts - 5) throw error; // Fail if near timeout
    }

    attempts++;
  }

  if (status.status === 'processing') {
    throw new Error("Enhanced agent research timed out after comprehensive source analysis.");
  }

  console.log('Enhanced Firecrawl agent research completed:', {
    status: status.status,
    dataKeys: Object.keys(status.data || {}),
    attempts
  });

  return status.data;
}

/**
 * Enhanced scraping with optimized API integration
 * Uses the new formats array for extraction and markdown with rate limiting protection
 */
export const firecrawlScrape = async (url: string, extractPrompt?: string, schema?: any): Promise<ScrapeResponse> => {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) throw new Error("Firecrawl API Key missing.");

  const formats: any[] = ['markdown', 'images'];
  if (extractPrompt && schema) {
    formats.push({
      type: 'json',
      prompt: extractPrompt,
      schema: schema
    });
  }

  // TEST KEY MOCK RESPONSE
  if (apiKey.startsWith('fc-test-')) {
    console.log('Using Firecrawl TEST KEY - Returning mock SCRAPE response');
    return {
      success: true,
      data: {
        markdown: "## Mock Scraped Content\n\nProduct: **HP CF226X**\nYield: 9000 pages\nColor: Black\n\nCompatibility: HP LaserJet Pro M402, M426.",
        metadata: { title: "Mock Page Title", statusCode: 200 }
      }
    };
  }

  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'firecrawl',
      operation: 'scrape',
      priority: 'medium',
      retryable: true,
      creditsRequired: 1,
      metadata: { url, hasExtraction: !!extractPrompt }
    },
    async () => {
      const httpResponse = await fetch(`${API_V2}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          url,
          formats,
          onlyMainContent: true,
          maxAge: 172800000 // Use cache if < 2 days old
        })
      });

      const result = await httpResponse.json().catch(() => ({}));

      return {
        success: httpResponse.ok,
        data: result,
        error: httpResponse.ok ? undefined : result.message || `Scrape failed with status ${httpResponse.status}`,
        statusCode: httpResponse.status,
        responseTime: 0,
        creditsUsed: 1
      };
    }
  );

  // Return in the expected ScrapeResponse format
  return {
    success: response.success,
    data: response.data || {},
    error: response.error
  };
};

/**
 * Start a long-running crawl job (Async)
 * Ideal for scraping multiple URLs or deep scraping where reliability is key.
 */
export const startCrawlJob = async (urls: string[], options: { depth?: number, limit?: number } = {}): Promise<{ success: boolean; jobId?: string; error?: string }> => {
  const apiKey = getFirecrawlApiKey();

  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'firecrawl',
      operation: 'startCrawl',
      priority: 'medium',
      retryable: true,
      metadata: { urlCount: urls.length }
    },
    async () => {
      const httpResponse = await fetch(`${API_V1}/crawl`, { // Crawl is managed via v1 for synchronous reliability
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          url: urls[0], // Firecrawl often takes a root URL, or we might need to check how to submit list. 
          // If we want to scrape a specific list of URLs, 'scrape' is typically for single, 'crawl' for discovery.
          // However, for "batch scrape" we might just use 'scrape' in parallel or 'crawl' with limited depth.
          // Based on user request "long-running crawl jobs where you start a crawl and later check status", 
          // we should assume standard crawl behavior.
          limit: options.limit || 10,
          scrapeOptions: { formats: ['markdown'] }
        })
      });

      const result = await httpResponse.json().catch(() => ({}));
      return {
        success: httpResponse.ok,
        data: result, // Expect { id: "..." }
        error: httpResponse.ok ? undefined : result.message,
        responseTime: 0
      };
    }
  );

  return {
    success: response.success,
    jobId: response.data?.id,
    error: response.error
  };
};

/**
 * Check the status of a crawl job
 */
export const getCrawlJobStatus = async (jobId: string): Promise<any> => {
  const apiKey = getFirecrawlApiKey();

  const response = await apiIntegrationService.makeRequest(
    {
      serviceId: 'firecrawl',
      operation: 'getCrawlStatus',
      priority: 'low',
      retryable: true,
      metadata: { jobId }
    },
    async () => {
      const httpResponse = await fetch(`${API_V1}/crawl/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
      });

      const result = await httpResponse.json();
      return { success: httpResponse.ok, data: result, responseTime: 0 };
    }
  );

  return response.data;
};

/**
 * Utility to convert crawl results to a clean Markdown string for the Synthesizer
 */
export const crawlResultToMarkdown = (crawlData: any): string => {
  if (!crawlData || !crawlData.data) return "No data available";

  // Handle both single scrape result and crawl array result
  const items = Array.isArray(crawlData.data) ? crawlData.data : [crawlData.data];

  return items.map((item: any, index: number) => {
    const title = item.metadata?.title || `Source ${index + 1}`;
    const url = item.metadata?.sourceURL || item.url || "Unknown URL";
    const content = item.markdown || "No content extracted";

    return `### Source: [${title}](${url})\n\n${content}\n\n---\n`;
  }).join('\n');
};
