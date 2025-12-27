
/**
 * Firecrawl Service Implementation
 * Production-ready wrapper for v2 API with enhanced API integration optimization
 * Implements rate limiting, circuit breaker patterns, and health monitoring
 */

import { apiIntegrationService, createApiIntegrationError } from './apiIntegrationService';

const API_V1 = 'https://api.firecrawl.dev/v1';
const API_V2 = 'https://api.firecrawl.dev/v2';
const STORAGE_KEY = 'firecrawl_api_key';

export const getFirecrawlApiKey = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return (process as any).env?.FIRECRAWL_API_KEY || '';
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
      headers: {
        'Authorization': `Bearer ${key.trim()}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (e) {
    console.error("Firecrawl validation network error:", e);
    return false;
  }
};

/**
 * Enhanced Firecrawl Agent with optimized API integration
 * Uses Search Grounding to find primary source URLs with rate limiting and circuit breaker protection
 */
export const firecrawlAgent = async (prompt: string, schema?: any, urls?: string[]) => {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) throw new Error("Firecrawl API Key missing.");

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
