export type RuMarketEligibility = 'ru_verified' | 'ru_unknown' | 'ru_rejected';

export type ProcessingStep =
  | 'idle'
  | 'normalization'
  | 'parsing'
  | 'discovery'
  | 'searching'
  | 'filtering'
  | 'scraping_nix'
  | 'scraping_compat'
  | 'enrichment'
  | 'analyzing'
  | 'auditing_images'
  | 'finalizing'
  | 'gate_check'
  | 'complete'
  | 'error'
  | 'failed';

export interface StepStatus {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  description?: string;
  timestamp?: string;
  logStartIndex?: number;
  logEndIndex?: number;
}

export type AutomationStatus = 'done' | 'needs_review' | 'failed';

// 2. Taxonomy (Strict)
export interface TypeClassification {
  family:
    | 'toner'
    | 'drum'
    | 'developer'
    | 'waste_toner'
    | 'maintenance_kit'
    | 'fuser'
    | 'ink'
    | 'ribbon'
    | 'other'
    | 'unknown';
  subtype: 'cartridge' | 'bottle' | 'unit' | 'integrated_drum' | 'separate_drum' | 'unknown';
}

// 4. Tech Specs
export interface TechSpecs {
  yield: {
    value: number | null;
    unit: 'pages' | 'copies' | 'ml' | 'g' | 'unknown';
    standard:
      | 'ISO_19752'
      | 'ISO_19798'
      | '5_percent_coverage'
      | 'manufacturer_stated'
      | 'unknown'
      | null;
  };
  color: string | null;
  is_integrated_drum: boolean;
  chip_type: 'oem' | 'compatible' | 'universal' | 'none' | 'unknown' | null;
}

export type YieldUnit = 'pages' | 'copies' | 'ml';

export interface DataSource {
  url: string;
  timestamp: Date;
  dataConfirmed: string[];
  confidence: number;
  sourceType:
    | 'nix_ru'
    | 'official'
    | 'compatibility_db'
    | 'marketplace'
    | 'google_search'
    | 'firecrawl_agent'
    | 'other';
  extractionMethod: string;
  rawData?: string;
  processingDuration?: number;
  retryCount?: number;
}

export interface EvidenceSnippet {
  url: string;
  snippet: string;
  fetched_at: string; // ISO
  content_hash?: string;
  source_rank?: 'oem' | 'retailer' | 'aggregator' | 'unknown';
}

export interface ConflictingValue {
  value: any;
  source: EvidenceSnippet;
  confidence: number;
}

export interface FieldEvidence<T> {
  value: T;
  confidence: number;

  // Core Provenance
  evidence_chain?: EvidenceSnippet[];
  source_url?: string; // Primary source
  raw_snippet?: string; // Primary snippet
  timestamp?: string; // Primary fetch time

  // Governance Status
  status?: 'verified' | 'conflict' | 'manual' | 'missing' | 'generated';
  is_conflict?: boolean; // Legacy flag, try to use status='conflict'

  // Conflict Details
  conflicting_values?: ConflictingValue[];

  // Meta
  method?: 'official' | 'consensus' | 'single_source' | 'fallback' | 'agent_result';
  locked_by_user?: boolean;
  last_verified_at?: string;
}

// 5.1 RU Compliance
export interface ComplianceRU {
  tn_ved_code: string | null;
  okpd2_code: string | null;
  mandatory_marking: boolean; // Honest Sign
  certification_type: 'mandatory' | 'voluntary' | 'refusal_letter' | 'none' | 'unknown' | null;
  has_sds: boolean;
  refusal_letter_info: string | null;
}

export interface MpnIdentity {
  mpn: string | null;
  series: string | null;
  canonical_model_name: string | null;
  cross_reference_mpns: string[];
  authenticity: 'oem' | 'compatible' | 'remanufactured' | 'refill' | 'fake' | 'unknown' | null;
  variant_flags?: {
    chip: boolean;
    counterless: boolean;
    high_yield: boolean;
    kit: boolean;
  };
}

export interface PrinterCompatibility {
  model: string;
  canonicalName: string; // Brand + Series + Index
  is_ru_confirmed: boolean;
  constraints: string[]; // e.g. "firmware_sensitive"
  sources: DataSource[];
  ruMarketEligibility: RuMarketEligibility;
  compatibilityConflict: boolean;
}

export interface PackagingInfo {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
  // Raw strings for audit
  raw_source_string?: string;

  confidence?: number;
  extraction_timestamp?: string;
  source_url?: string;
}

export interface YieldInfo {
  value: number;
  unit: YieldUnit;
  coverage_percent?: number;
  source_raw?: string;
}

export interface ImageCandidate {
  url: string;
  width: number;
  height: number;
  white_bg_score: number;
  is_packaging: boolean;
  has_watermark: boolean;
  has_oem_logo: boolean;
  passes_rules: boolean;
  reject_reasons: string[];
  source?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  source_url?: string;
}

export interface ConfidenceScores {
  model_name: number;
  short_model: number;
  logistics: number;
  compatibility: number;
  faq: number;
  overall: number;
  data_completeness: number;
  source_reliability: number;
}

export interface RelatedItem {
  model: string;
  type: string;
  relationship: string;
}

export interface EnhancedRelatedItem extends RelatedItem {
  priority: number;
  confidence: number;
  sourceCount: number;
  printerOverlap: number;
  yieldComparison?: 'higher' | 'lower' | 'same' | 'unknown';
  colorVariant?: string;
  isOEM: boolean;
  estimatedPrice?: 'higher' | 'lower' | 'same' | 'unknown';
  availability: 'high' | 'medium' | 'low' | 'unknown';
  sources: {
    url: string;
    sourceType: 'cartridge_ru' | 'rashodnika_net' | 'oem' | 'marketplace' | 'other';
    confidence: number;
    extractedAt: string;
  }[];
}

export interface ConsumableData {
  // 1. Identity & Status
  supplier_title_raw: string;
  title_norm: string;
  automation_status: AutomationStatus;
  publish_ready: boolean;

  mpn_identity: MpnIdentity;
  reviewReason?: string;

  // 1.1 Marketing
  marketing: {
    seo_title: string | null;
    description: string | null;
    feature_bullets: string[];
    keywords: string[];
  };

  // 2. Taxonomy
  brand: string | null;
  type_classification: TypeClassification;

  // DEPRECATED: mapped from type_classification
  consumable_type?: string;

  aliases: string[];
  gtin: string[];

  // 3. Compatibility (RU)
  compatible_printers_ru: PrinterCompatibility[];
  compatible_printers_unverified: PrinterCompatibility[]; // Legacy/fallback
  // Deprecated simple list
  printers_ru: string[];

  // 4. Tech Specs
  tech_specs: TechSpecs;

  // DEPRECATED: direct accessors
  yield?: YieldInfo | null;
  color?: string | null;
  has_chip?: boolean | 'unknown';
  has_page_counter?: boolean | 'unknown';

  // 5. Logistics (Enhanced)
  logistics: {
    package_weight_g: number | null;
    product_weight_g: number | null;
    width_mm: number | null;
    height_mm: number | null;
    depth_mm: number | null;
    origin_country: string | null;
    // hs_code deprecated, moved to compliance_ru.tn_ved_code
    box_contents: string[];
    transport_symbols?: string[];
  } | null;

  compliance_ru?: ComplianceRU;

  packaging_from_nix?: PackagingInfo | null; // Old field kept for legacy ref

  connectivity?: {
    connection_interfaces: string[];
    ports: string[];
  };

  // 6. Relations
  related_consumables_display?: EnhancedRelatedItem[];
  related_consumables_full?: EnhancedRelatedItem[];
  related_skus?: string[];
  related_ids?: { id: string; type: string }[];

  // 7. Media
  images: ImageCandidate[];
  product_image_main?: string | null;

  // 8. Audit
  sources: DataSource[];
  normalization_log?: string[];
  validation_errors?: string[];
  missing_fields?: string[];

  // Ext
  confidence?: ConfidenceScores;
  faq?: FAQItem[];

  // Traceability Layer
  _evidence?: {
    [key: string]: FieldEvidence<any> | undefined;
  };
}

// Status Types
export type ValidationStatus = 'pending' | 'processing' | 'published' | 'needs_review' | 'failed';

export interface ManualQueueEntry {
  itemId: string;
  inputRaw: string;
  failureReasons: any[]; // ErrorDetail[], typed as any to avoid circular import if needed, or import above
  extractedData: Partial<ConsumableData>;
  missingFields: string[];
  recommendations: string[];
  context: {
    processingHistory: any[];
    evidenceSources: any[];
    confidenceScores?: ConfidenceScores;
    qualityMetrics?: any;
  };
  priority: 'low' | 'medium' | 'high';
  estimatedResolutionTime: number; // minutes
  queuedAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
}

export interface EnrichedItem {
  id: string; // job_run_id
  input_raw: string;
  input_hash: string;

  data: ConsumableData;

  status: ValidationStatus; // maps to data.automation_status

  // Meta
  ruleset_version: string;
  parser_version: string;
  created_at: number;
  updated_at: number;
  processed_at: string;

  // Legacy support (optional)
  evidence?: any;
  validation_errors?: string[];

  // Runtime / UI Extensions
  current_step?: ProcessingStep;
  error_details?: any[]; // Detailed error objects
  failure_reasons?: string[];
  retry_count?: number;
  is_retryable?: boolean;
  last_retry_at?: string;
  next_retry_at?: string;
  processing_duration_ms?: number;
  quality_score?: number;

  // Agent Extensions
  manual_queue_entry?: ManualQueueEntry;
  thinking_process?: string;
}

// --- FIRESEARCH CONTRACT TYPES ---

export interface FiresearchPackaging {
  package_mm: {
    length: number;
    width: number;
    height: number;
  };
  package_weight_g: number;
  evidence_urls: string[];
  not_found_on_nix: boolean;
}

export interface FiresearchCompatibility {
  printers: string[]; // List of models
  evidence_urls: string[];
  needs_review: boolean;
  exclusion_notes: string[];
}

export interface FiresearchRelated {
  for_similar_products_block: string[]; // List of known compatible consumable models
  evidence_urls: string[];
  needs_review: boolean;
}

export interface FiresearchImage {
  url: string;
  imageWidth?: number;
  imageHeight?: number;
  no_watermark_likely: boolean;
  no_trademark_likely: boolean;
  notes?: string;
}

export interface FiresearchFAQ {
  q: string;
  a: string;
  evidence_urls: string[];
}

export interface FiresearchMeta {
  run_mode: 'fast' | 'standard' | 'exhaustive';
  budgets: {
    time_ms: number;
    calls: number;
    sources: number;
  };
  stats: {
    iterations: number;
    sources_collected: number;
    calls_made: number;
    duration_ms: number;
  };
  warnings: string[];
  conflicts?: {
    field: string;
    valueA: any;
    valueB: any;
    sourceA: string;
    sourceB: string;
    strategy_used: 'first_win' | 'consensus' | 'ask_user';
    resolution: 'resolved' | 'unresolved' | 'overridden';
  }[];
}

// Minimal Contract for Parsed Data (From Title)
export interface FiresearchParsed {
  brand: string;
  consumable_type: string;
  model_oem: string;
  model_short: string[];
  printer_models_from_title: string[];
  yield: {
    value: number | 'unknown';
    unit: 'pages' | 'copies' | 'unknown';
  };
  color: 'black' | 'cyan' | 'magenta' | 'yellow' | 'unknown';
  notes: string[];
}

// EXTEND ConsumableData to include these strict contract fields
// We keep the old fields for backward compatibility if needed, but the new ones are primary for the output
export type StrictConsumableData = ConsumableData & {
  parsed?: FiresearchParsed;
  packaging?: FiresearchPackaging;
  compatibility_ru?: FiresearchCompatibility;
  related_consumables?: FiresearchRelated;
  image_candidates?: FiresearchImage[];
  faq?: FiresearchFAQ[];
  meta?: FiresearchMeta;
};
