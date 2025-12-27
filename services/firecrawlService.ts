
/**
 * Firecrawl Service Implementation
 * Production-ready wrapper for v2 API with v1 fallback for stable validation.
 */

const API_V1 = 'https://api.firecrawl.dev/v1';
const API_V2 = 'https://api.firecrawl.dev/v2';
const STORAGE_KEY = 'firecrawl_api_key';

export const getFirecrawlApiKey = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  // Use a safe check for process.env
  try {
    return (window as any).process?.env?.FIRECRAWL_API_KEY || '';
  } catch (e) {
    return '';
  }
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
  if (!key || !key.trim().startsWith('fc-')) return false;
  
  try {
    const response = await fetch(`${API_V1}/team`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Authorization': `Bearer ${key.trim()}`
        // Removed Content-Type for GET to avoid unnecessary CORS preflights
      }
    });
    
    return response.ok;
  } catch (e) {
    console.error("Firecrawl validation network error:", e);
    // If it's a TypeError, it's likely a CORS or network failure.
    // We throw a specific error so the UI can handle it.
    if (e instanceof TypeError && e.message === 'Failed to fetch') {
       throw new Error("Network error: Could not reach Firecrawl API. Check your internet connection or ad-blocker settings.");
    }
    return false;
  }
};

/**
 * Firecrawl Agent: Autonomous data gathering (v2).
 * Returns job info which may be 'completed' or 'processing'.
 */
export const firecrawlAgent = async (prompt: string, schema?: any, urls?: string[]) => {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) throw new Error("Firecrawl API Key missing.");

  const response = await fetch(`${API_V2}/agent`, {
    method: 'POST',
    mode: 'cors',
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

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Agent Error: ${result.message || response.status}`);
  }

  return result; 
};

/**
 * Polls the status of an agent job (v2).
 */
export const getAgentStatus = async (jobId: string) => {
  const apiKey = getFirecrawlApiKey();
  const response = await fetch(`${API_V2}/agent/${jobId}`, {
    method: 'GET',
    mode: 'cors',
    headers: { 
      'Authorization': `Bearer ${apiKey.trim()}`
      // Removed Content-Type for GET
    }
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Status Check Failed: ${err.message || response.status}`);
  }
  
  return await response.json();
};

/**
 * Scrapes a single URL using v2.
 * Uses the new formats array for extraction and markdown.
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

  const response = await fetch(`${API_V2}/scrape`, {
    method: 'POST',
    mode: 'cors',
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

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      data: {},
      error: result.message || `Scrape failed with status ${response.status}`
    };
  }

  return result;
};
