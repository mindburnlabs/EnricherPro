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
    white_bg_score: number;
    is_packaging: boolean;
    has_watermark: boolean;
    has_oem_logo: boolean;
    passes_rules: boolean;
    reject_reasons: string[];
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
    compatible_printers_all?: PrinterCompatibility[];
    compatible_printers_ru?: PrinterCompatibility[];
    compatible_printers_unverified?: PrinterCompatibility[];
    related_consumables: RelatedItem[];
    related_consumables_full?: EnhancedRelatedItem[];
    related_consumables_display?: EnhancedRelatedItem[];
    related_consumables_categories?: {
        companions: EnhancedRelatedItem[];
        alternatives: EnhancedRelatedItem[];
        colorVariants: EnhancedRelatedItem[];
        replacements: EnhancedRelatedItem[];
    };
    packaging_from_nix: PackagingInfo | null;
    images: ImageCandidate[];
    faq: FAQItem[];
    confidence?: ConfidenceScores;
    normalization_log?: string[];
}
