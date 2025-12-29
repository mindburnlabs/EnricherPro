
export type RuMarketEligibility = 'ru_verified' | 'ru_unknown' | 'ru_rejected';

export type ProcessingStep = 'idle' | 'searching' | 'filtering' | 'scraping_nix' | 'scraping_compat' | 'analyzing' | 'auditing_images' | 'finalizing' | 'gate_check' | 'complete' | 'error';

export type AutomationStatus = 'done' | 'needs_review' | 'failed';

export type ConsumableType =
    | 'toner_cartridge'
    | 'drum_unit'
    | 'ink_cartridge'
    | 'maintenance_kit'
    | 'waste_toner'
    | 'bottle'
    | 'other'
    | 'unknown';

export type YieldUnit = 'pages' | 'copies' | 'ml';

export interface DataSource {
    url: string;
    timestamp: Date;
    dataConfirmed: string[];
    confidence: number;
    sourceType: 'nix_ru' | 'official' | 'compatibility_db' | 'marketplace' | 'google_search' | 'perplexity_sonar' | 'firecrawl_agent' | 'other';
    extractionMethod: string;
    rawData?: string;
    processingDuration?: number;
    retryCount?: number;
}

export interface FieldEvidence<T> {
    value: T;
    urls: string[];
    extraction_method: string;
    confidence: number;
    source_type?: DataSource['sourceType'];
    raw_snippet?: string;
}

export interface MpnIdentity {
    mpn: string;
    variant_flags: {
        chip: boolean;
        counterless: boolean;
        high_yield: boolean;
        kit: boolean;
    };
    canonical_model_name: string; // e.g. "W1331X"
}

export interface PrinterCompatibility {
    model: string;
    canonicalName: string; // Brand + Series + Index
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

    // 2. Core Attributes
    brand: string | null; // e.g., HP, Kyocera
    consumable_type: ConsumableType;

    /** @deprecated Use mpn_identity.mpn or mpn_identity.canonical_model_name */
    model: string | null;

    short_model: string | null;
    model_alias_short: string | null;

    yield: YieldInfo | null;
    color: string | null; // Normalized: Black, Cyan, etc.

    has_chip: boolean | 'unknown';
    has_page_counter: boolean | 'unknown';

    // 3. Compatibility (Printers)
    printers_ru: string[]; // Final display list (names only)
    compatible_printers_ru: PrinterCompatibility[]; // Full objects
    compatible_printers_unverified: PrinterCompatibility[];

    // 4. Logistics (NIX.ru critical)
    packaging_from_nix: PackagingInfo | null;

    // 5. Relations
    related_consumables_display?: EnhancedRelatedItem[];
    related_consumables_full?: EnhancedRelatedItem[];

    // 6. Media
    images: ImageCandidate[];
    product_image_main?: string | null; // valid URL

    // 7. Audit & Logs
    sources: DataSource[]; // Global list of all sources used
    normalization_log?: string[];
    validation_errors?: string[];
    missing_fields?: string[]; // For manual queue

    // Compatibility / Extensions
    confidence?: ConfidenceScores;
    faq?: FAQItem[];
    related_consumables_categories?: {
        companions: string[];
        alternatives: string[];
        colorVariants: string[];
        replacements: string[];
    };

    // Traceability Layer - Maps 1:1 to key data fields for UI evidence
    _evidence?: {
        brand?: FieldEvidence<string>;
        consumable_type?: FieldEvidence<string>;
        model?: FieldEvidence<string>;
        yield?: FieldEvidence<YieldInfo>;
        packaging_from_nix?: FieldEvidence<PackagingInfo>;
        compatible_printers_ru?: FieldEvidence<PrinterCompatibility[]>;
        images?: FieldEvidence<ImageCandidate[]>;
        [key: string]: FieldEvidence<any> | undefined;
    };
}

// Status Types
export type ValidationStatus = 'pending' | 'processing' | 'ok' | 'needs_review' | 'failed';

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
