import { ConsumableData, PackagingInfo, PrinterCompatibility, RuMarketEligibility, DataSource } from "../types";

export interface GateResult {
    passed: boolean;
    reason: string;
    confidencePenalty: number;
    flags: string[];
}

/**
 * LOGISTICS GATE
 * Enforces strict NIX.ru sourcing for dimensions and weight.
 * If NIX data is missing, we flag it. If it comes from non-NIX, we reject or flag heavy penalty.
 */
export const checkLogisticsGate = (data: ConsumableData): GateResult => {
    const pkg = data.packaging_from_nix;

    if (!pkg) {
        return {
            passed: false,
            reason: "No packaging data found (NIX.ru source required)",
            confidencePenalty: 0.5,
            flags: ['missing_logistics']
        };
    }

    // Validate Source URL
    const isNixSource = pkg.source_url && (
        pkg.source_url.includes('nix.ru') ||
        pkg.source_url.includes('elets.nix.ru') ||
        pkg.source_url.includes('max.nix.ru')
    );

    if (!isNixSource) {
        return {
            passed: false,
            reason: "Packaging data provided but source is not NIX.ru",
            confidencePenalty: 0.4,
            flags: ['unverified_logistics_source']
        };
    }

    // Validate Completeness
    if (!pkg.width_mm || !pkg.height_mm || !pkg.depth_mm || !pkg.weight_g) {
        return {
            passed: true, // Soft pass but flagged
            reason: "Partial NIX.ru data found (some dimensions missing)",
            confidencePenalty: 0.1,
            flags: ['partial_logistics']
        };
    }

    return {
        passed: true,
        reason: "Verified NIX.ru logistics data",
        confidencePenalty: 0,
        flags: []
    };
};

// Helper to identify source category by URL or type
const classifySource = (source: DataSource): 'oem' | 'ru_retailer' | 'nix' | 'other' => {
    if (source.sourceType === 'official') return 'oem';
    if (source.sourceType === 'nix_ru') return 'nix';

    try {
        const hostname = new URL(source.url).hostname;
        // Basic heuristics for major known domains
        if (hostname.includes('hp.com') || hostname.includes('canon') || hostname.includes('xerox') || hostname.includes('brother') || hostname.includes('kyocera') || hostname.includes('ricoh') || hostname.includes('epson')) {
            return 'oem';
        }
        if (hostname.includes('nix.ru')) return 'nix';
        if (hostname.includes('cartridge.ru') || hostname.includes('rashodnika.net') || hostname.includes('dns-shop.ru') || hostname.includes('citilink.ru') || hostname.includes('onlinetrade.ru')) {
            return 'ru_retailer';
        }
    } catch {
        // ignore invalid urls
    }
    return 'other';
};

/**
 * COMPATIBILITY GATE
 * Requires at least 2 independent compatibility sources to mark as 'ru_verified'.
 * OR 1 reliable OEM source that explicitly lists RU models.
 */
export const checkCompatibilityGate = (printer: PrinterCompatibility): GateResult => {
    const sources = printer.sources || [];

    if (sources.length === 0) {
        return {
            passed: false,
            reason: "No sources for this printer compatibility",
            confidencePenalty: 1.0,
            flags: ['no_sources']
        };
    }

    // Count distinct meaningful sources (domains)
    const domains = new Set(sources.map(s => {
        try {
            return new URL(s.url).hostname;
        } catch {
            return 'unknown';
        }
    }));

    const uniqueSourceCount = domains.size;

    const classifications = sources.map(classifySource);
    const hasOem = classifications.includes('oem');
    const hasRuRetailer = classifications.includes('ru_retailer') || classifications.includes('nix');

    // Policy: 
    // 1. If OEM says yes -> Verified (High trust)
    // 2. If 2+ sources and at least one is RU Retailer -> Verified
    // 3. If 1 RU Retailer -> Unknown/Pending

    if (hasOem) {
        return {
            passed: true,
            reason: "Verified by OEM source",
            confidencePenalty: 0,
            flags: ['oem_verified']
        };
    }

    if (uniqueSourceCount >= 2 && hasRuRetailer) {
        return {
            passed: true,
            reason: "Consensus from 2+ sources including RU retailer",
            confidencePenalty: 0,
            flags: ['consensus_verified']
        };
    }

    if (hasRuRetailer) {
        return {
            passed: false,
            reason: "Single RU source (needs confirmation)",
            confidencePenalty: 0.2,
            flags: ['single_source_pending']
        };
    }

    return {
        passed: false,
        reason: "Insufficient verification (No OEM, No consolidated RU sources)",
        confidencePenalty: 0.5,
        flags: ['unverified']
    };
};

/**
 * Aggregate Gate Check for the whole Item
 */
export const evaluateQualityGates = (data: ConsumableData): { passed: boolean, report: any } => {
    const logistics = checkLogisticsGate(data);

    // Check compatibility sample (just check stats)
    const ruPrinters = data.compatible_printers_ru || [];
    const verifiedCount = ruPrinters.filter(p => p.ruMarketEligibility === 'ru_verified').length;
    const compatibilityScore = ruPrinters.length > 0 ? (verifiedCount / ruPrinters.length) : 0;

    const compatibilityGate = {
        passed: compatibilityScore > 0.5, // Require > 50% of claimed RU printers to be actually verified
        reason: `Verified rate: ${(compatibilityScore * 100).toFixed(1)}%`,
        confidencePenalty: compatibilityScore > 0.8 ? 0 : 0.2,
        flags: compatibilityScore < 0.5 ? ['low_verification_rate'] : []
    };

    const allPassed = logistics.passed && compatibilityGate.passed;

    return {
        passed: allPassed,
        report: {
            logistics,
            compatibility: compatibilityGate
        }
    };
};
