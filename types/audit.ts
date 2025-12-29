import { ProcessingStep } from './domain';

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
    data_completeness_score: number; // 0-1
    source_reliability_score: number; // 0-1
    validation_pass_rate: number; // 0-1
    processing_efficiency: number; // 0-1
    audit_completeness: number; // 0-1
    last_calculated: string;
    total_sources_used: number;
    failed_validations: string[];
    missing_required_fields: string[];
}

export interface AuditTrailEntry {
    timestamp: string;
    action: 'data_extraction' | 'validation' | 'transformation' | 'enrichment' | 'quality_check' | 'error_handling';
    component: string;
    details: string;
    input_hash?: string;
    output_hash?: string;
    confidence_impact?: number;
    data_fields_affected: string[];
    source_urls?: string[];
    processing_time_ms?: number;
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
