
// Domain Types

export type ValidationStatus = 'pending' | 'processing' | 'ok' | 'needs_review' | 'failed';
export type ProcessingStep = 'idle' | 'searching' | 'scraping_nix' | 'scraping_compat' | 'analyzing' | 'auditing_images' | 'finalizing';

// Enhanced Error Handling Types
export type FailureReason = 
  | 'failed_parse_model'
  | 'failed_parse_type' 
  | 'failed_parse_brand'
  | 'missing_nix_dimensions_weight'
  | 'nix_data_from_fallback'
  | 'low_confidence_nix_data'
  | 'low_confidence_agent_research'
  | 'no_oem_sources'
  | 'insufficient_ru_verification'
  | 'invalid_dimensions'
  | 'invalid_weight'
  | 'missing_valid_image'
  | 'image_validation_issues'
  | 'ru_eligibility_unknown'
  | 'compatibility_conflict'
  | 'incomplete_data'
  | 'api_rate_limit_exceeded'
  | 'external_service_timeout'
  | 'network_connectivity_error'
  | 'authentication_failed'
  | 'data_parsing_error'
  | 'validation_timeout';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory = 
  | 'parsing_error'
  | 'data_quality'
  | 'external_service'
  | 'validation_failure'
  | 'network_error'
  | 'authentication_error'
  | 'timeout_error'
  | 'configuration_error';

export interface ErrorDetail {
  reason: FailureReason;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  step?: ProcessingStep;
  retryable: boolean;
  suggestedAction?: string;
  technicalDetails?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: FailureReason[];
}

export interface ManualQueueEntry {
  itemId: string;
  inputRaw: string;
  failureReasons: ErrorDetail[];
  extractedData: Partial<ConsumableData>;
  missingFields: string[];
  recommendations: string[];
  context: {
    processingHistory: ProcessingHistoryEntry[];
    evidenceSources: EvidenceSource[];
    confidenceScores?: ConfidenceScores;
    qualityMetrics?: QualityMetrics;
  };
  priority: 'low' | 'medium' | 'high';
  estimatedResolutionTime: number; // minutes
  queuedAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
}

export interface BatchProcessingProgress {
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  needsReviewItems: number;
  currentItem?: string;
  currentStep?: ProcessingStep;
  estimatedTimeRemaining: number; // seconds
  averageProcessingTime: number; // seconds per item
  startedAt: string;
  lastUpdatedAt: string;
  throughputPerMinute: number;
  errorRate: number; // percentage
}

export interface PackagingInfo {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
  raw_source_string?: string;
  confidence?: number;
  extraction_timestamp?: string;
  source_url?: string;
}

export interface YieldInfo {
  value: number;
  unit: 'pages' | 'copies' | 'ml';
  coverage_percent?: number;
}

export interface ImageCandidate {
  url: string;
  width: number;
  height: number;
  white_bg_score: number; // 0-1
  is_packaging: boolean;
  has_watermark: boolean;
  has_oem_logo: boolean; // We want non-OEM look for compatible items
  passes_rules: boolean;
  reject_reasons: string[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface EvidenceSource {
  url: string;
  source_type: 'nix_ru' | 'official' | 'compatibility_db' | 'marketplace' | 'google_search' | 'other';
  claims: string[];
  evidence_snippets_by_claim: Record<string, string>; 
  extracted_at: string;
  confidence: number;
  extraction_method: string;
  processing_duration_ms?: number;
  retry_count?: number;
  validation_status?: 'validated' | 'pending' | 'failed';
  quality_score?: number;
}

export interface EvidenceBlock {
  sources: EvidenceSource[];
  grounding_metadata?: GroundingSource[];
  processing_history: ProcessingHistoryEntry[];
  quality_metrics: QualityMetrics;
  audit_trail: AuditTrailEntry[];
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

// Processing History and Audit Trail Types
export interface ProcessingHistoryEntry {
  step: ProcessingStep;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  input_data?: any;
  output_data?: any;
  error_message?: string;
  confidence_before?: number;
  confidence_after?: number;
  data_changes?: string[];
}

export interface QualityMetrics {
  data_completeness_score: number; // 0-1, percentage of required fields populated
  source_reliability_score: number; // 0-1, weighted average of source confidences
  validation_pass_rate: number; // 0-1, percentage of validations that passed
  processing_efficiency: number; // 0-1, based on retry counts and processing times
  audit_completeness: number; // 0-1, percentage of processing steps with complete audit trail
  last_calculated: string;
  total_sources_used: number;
  failed_validations: string[];
  missing_required_fields: string[];
}

export interface AuditTrailEntry {
  timestamp: string;
  action: 'data_extraction' | 'validation' | 'transformation' | 'enrichment' | 'quality_check' | 'error_handling';
  component: string; // Which service/function performed the action
  details: string;
  input_hash?: string;
  output_hash?: string;
  confidence_impact?: number; // How this action affected overall confidence
  data_fields_affected: string[];
  source_urls?: string[];
  processing_time_ms?: number;
}

export interface RelatedItem {
  model: string;
  type: string;
  relationship: string; // e.g., "Companion Drum" or "Alternative High Yield"
}

// Enhanced related item with additional metadata for improved discovery
export interface EnhancedRelatedItem extends RelatedItem {
  priority: number;           // 1-10 priority for display ordering
  confidence: number;         // 0-1 confidence in the relationship
  sourceCount: number;        // Number of sources confirming this relationship
  printerOverlap: number;     // Percentage of printer compatibility overlap
  yieldComparison?: 'higher' | 'lower' | 'same' | 'unknown';
  colorVariant?: string;      // Color if different from current item
  isOEM: boolean;            // Whether this is an OEM product
  estimatedPrice?: 'higher' | 'lower' | 'same' | 'unknown';
  availability: 'high' | 'medium' | 'low' | 'unknown';
  
  // Source tracking
  sources: {
    url: string;
    sourceType: 'cartridge_ru' | 'rashodnika_net' | 'oem' | 'marketplace' | 'other';
    confidence: number;
    extractedAt: string;
  }[];
}

// Russian Market Filtering Types
export type RuMarketEligibility = 'ru_verified' | 'ru_unknown' | 'ru_rejected';

export interface DataSource {
  url: string;
  timestamp: Date;
  dataConfirmed: string[];
  confidence: number;
  sourceType: 'nix_ru' | 'official' | 'compatibility_db' | 'marketplace' | 'google_search' | 'other';
  extractionMethod: string;
  rawData?: string;
  processingDuration?: number;
  retryCount?: number;
}

export interface PrinterCompatibility {
  model: string;
  canonicalName: string;
  sources: DataSource[];
  ruMarketEligibility: RuMarketEligibility;
  compatibilityConflict: boolean;
}

export interface RussianSourceConfig {
  name: string;
  baseUrl: string;
  priority: number;
  isOfficial: boolean;
  searchPatterns: string[];
}

export interface RuMarketFilterConfig {
  minSourcesForVerification: number;
  russianSources: RussianSourceConfig[];
  officialDistributorBonus: number;
  confidenceThreshold: number;
}

// Publication Readiness Types
export interface PublicationReadinessScore {
  overall_score: number;
  component_scores: {
    required_fields: number;
    data_quality: number;
    russian_market: number;
    image_validation: number;
    source_reliability: number;
  };
  is_ready: boolean;
  blocking_issues: string[];
  recommendations: string[];
  confidence_level: 'high' | 'medium' | 'low';
  estimated_manual_effort: number;
}

export interface PublicationReadinessReport {
  total_items: number;
  ready_for_publication: number;
  needs_minor_fixes: number;
  needs_major_work: number;
  blocked_items: number;
  average_readiness_score: number;
  top_blocking_issues: Array<{ issue: string; count: number; severity: 'high' | 'medium' | 'low' }>;
  readiness_by_brand: Record<string, { ready: number; total: number; avg_score: number }>;
  quality_trends: {
    improving: number;
    stable: number;
    declining: number;
  };
}

// MAIN SCHEMA
export interface ConsumableData {
  brand: string | null; 
  consumable_type: 'toner_cartridge' | 'drum_unit' | 'consumable_set' | 'ink_cartridge' | 'bottle' | 'other' | null;
  model: string | null; 
  short_model: string | null; 
  model_alias_short: string | null;
  yield: YieldInfo | null;
  color: string | null; 
  has_chip: boolean | 'unknown';
  has_page_counter: boolean | 'unknown';
  printers_ru: string[]; // Legacy field - kept for backward compatibility
  compatible_printers_all?: PrinterCompatibility[]; // All discovered printers
  compatible_printers_ru?: PrinterCompatibility[]; // Russian market verified printers
  compatible_printers_unverified?: PrinterCompatibility[]; // Unverified printers
  related_consumables: RelatedItem[]; 
  // Enhanced related products fields
  related_consumables_full?: EnhancedRelatedItem[]; // Complete list for data storage
  related_consumables_display?: EnhancedRelatedItem[]; // Curated list for UI display (8-12 items)
  related_consumables_categories?: {
    companions: EnhancedRelatedItem[];   // Same printer, different consumable type
    alternatives: EnhancedRelatedItem[]; // Same type, different specifications
    colorVariants: EnhancedRelatedItem[]; // Same model, different colors
    replacements: EnhancedRelatedItem[]; // Newer/older model replacements
  }; 
  packaging_from_nix: PackagingInfo | null;
  images: ImageCandidate[];
  faq: FAQItem[];
  confidence?: ConfidenceScores;
  normalization_log?: string[];
}

// Enriched Item wrapper
export interface EnrichedItem {
  id: string;
  input_raw: string; 
  data: ConsumableData;
  evidence: EvidenceBlock;
  status: ValidationStatus;
  current_step?: ProcessingStep;
  validation_errors: string[];
  // Enhanced error handling
  error_details?: ErrorDetail[];
  failure_reasons?: FailureReason[];
  retry_count: number;
  last_retry_at?: string;
  next_retry_at?: string;
  is_retryable?: boolean;
  manual_queue_entry?: ManualQueueEntry;
  thinking_process?: string;
  created_at: number;
  updated_at: number;
  // Enhanced audit trail fields
  job_run_id: string;
  input_hash: string;
  ruleset_version: string;
  parser_version: string;
  processed_at: string;
  processing_duration_ms?: number;
  quality_score?: number;
}

// Context/State Types
export interface AppState {
  items: EnrichedItem[];
  queue: string[]; 
  processingId: string | null;
  filterStatus: ValidationStatus | 'all';
  searchQuery: string;
  // Enhanced batch processing
  batchProgress?: BatchProcessingProgress;
  manualQueue: ManualQueueEntry[];
  retryQueue: string[]; // Item IDs scheduled for retry
  // Enhanced error tracking
  errorSummary?: {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    retryableErrors: number;
    criticalErrors: number;
  };
}

export interface ProcessingStats {
  total: number;
  ok: number;
  needs_review: number;
  failed: number;
  pending: number;
  // Enhanced stats
  retrying: number;
  manual_queue: number;
  error_rate: number;
  average_processing_time: number;
  throughput_per_hour: number;
  // Additional enhanced metrics
  critical_errors: number;
  retryable_errors: number;
  completion_rate: number;
  quality_score_average: number;
}
