/**
 * Type definitions for the research workflow
 * Fixes @ts-ignore annotations and provides proper typing
 */

import type { AgentPlan } from '../services/agents/DiscoveryAgent.js';
import type { StrictConsumableData } from './domain.js';
import type { VerificationResult } from '../services/agents/QualityGatekeeper.js';

// Extended AgentPlan with Graph-Lite evidence
export interface AgentPlanWithEvidence extends AgentPlan {
  evidence?: Record<string, any>;
}

// Research workflow event payload
export interface ResearchEventData {
  jobId: string;
  tenantId: string;
  inputRaw: string;
  mode?: 'fast' | 'balanced' | 'deep';
  forceRefresh?: boolean;
  apiKeys?: Record<string, string>;
  agentConfig?: {
    prompts?: {
      discovery?: string;
      synthesis?: string;
      logistics?: string;
    };
  };
  sourceConfig?: {
    official: boolean;
    marketplace: boolean;
    community: boolean;
    specificOfficial?: string[];
    specificMarketplace?: string[];
    specificCommunity?: string[];
    blockedDomains?: string[];
  };
  budgets?: {
    maxQueries?: number;
    limitPerQuery?: number;
    concurrency?: number;
  };
  previousJobId?: string;
  language?: string;
  model?: string;
  useFlashPlanner?: boolean;
}

// Research result item
export interface ResearchResult {
  url: string;
  title: string;
  markdown: string;
  source_type:
    | 'nix_ru'
    | 'official'
    | 'marketplace'
    | 'other'
    | 'direct_scrape'
    | 'direct_scrape_batch'
    | 'fallback_search'
    | 'fallback_rescue'
    | 'fallback_scrape'
    | 'fallback_map'
    | 'fallback_crawl'
    | 'fallback_agent'
    | 'fallback_enrichment'
    | 'agent_result'
    | 'deep_crawl'
    | 'crawl_result'
    | 'graph_lite';
  screenshot?: string;
  timestamp?: string;
}

// Frontier task types
export type FrontierTaskType =
  | 'query'
  | 'url'
  | 'domain_crawl'
  | 'firecrawl_agent'
  | 'deep_crawl'
  | 'crawl_status'
  | 'domain_map'
  | 'enrichment';

export interface FrontierTask {
  id: string;
  jobId: string;
  type: FrontierTaskType;
  value: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  depth: number;
  priority: number;
  meta?: {
    actions?: Array<{ type: string; selector?: string; milliseconds?: number }>;
    location?: { country?: string; languages?: string[] };
    mobile?: boolean;
    waitFor?: number;
    schema?: any;
    goal?: string;
    source?: string;
    strategy?: string;
    target_domain?: string;
    checks?: number;
    originalUrl?: string;
    title?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Graph-Lite source document for pseudo-source creation
export interface GraphLiteSourceDoc {
  jobId: string;
  url: string;
  domain: string;
  rawContent: string;
  status: 'success' | 'failed' | 'blocked';
  extractedMetadata?: {
    title?: string;
    type?: string;
    screenshot?: string;
  };
}

// Workflow completion result
export interface WorkflowResult {
  success: boolean;
  itemId?: string;
  status?: string;
  data?: Partial<StrictConsumableData>;
  verification?: VerificationResult;
}

// Helper type for safe plan access
export function hasEvidence(plan: AgentPlan): plan is AgentPlanWithEvidence {
  return 'evidence' in plan && plan.evidence !== undefined;
}

// Helper to create Graph-Lite URL
export function createGraphLiteUrl(mpn: string | null): string {
  return `graph://${mpn || 'internal'}`;
}
