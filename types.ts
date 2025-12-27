
// Domain Types

export type ValidationStatus = 'pending' | 'processing' | 'ok' | 'needs_review' | 'failed';
export type ProcessingStep = 'idle' | 'searching' | 'scraping_nix' | 'scraping_compat' | 'analyzing' | 'auditing_images' | 'finalizing';

export interface PackagingInfo {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
  raw_source_string?: string;
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
}

export interface EvidenceBlock {
  sources: EvidenceSource[];
  grounding_metadata?: GroundingSource[];
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
}

export interface RelatedItem {
  model: string;
  type: string;
  relationship: string; // e.g., "Companion Drum" or "Alternative High Yield"
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
  printers_ru: string[]; 
  related_consumables: RelatedItem[]; 
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
  thinking_process?: string;
  created_at: number;
  updated_at: number;
}

// Context/State Types
export interface AppState {
  items: EnrichedItem[];
  queue: string[]; 
  processingId: string | null;
  filterStatus: ValidationStatus | 'all';
  searchQuery: string;
}

export interface ProcessingStats {
  total: number;
  ok: number;
  needs_review: number;
  failed: number;
  pending: number;
}
