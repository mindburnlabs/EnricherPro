
import { StrictConsumableData } from '../../types/domain.js';

export interface VerificationResult {
    isValid: boolean;
    score: number;
    errors: string[];
    warnings: string[];
    stages: {
        brand: boolean;
        identity: boolean;
        consistency: boolean;
        logistics: boolean;
        compatibility: boolean;
        attribution: boolean;
        completeness: boolean;
        deduplication: boolean;
    };
}

export class QualityGatekeeper {

    static async validate(data: Partial<StrictConsumableData>): Promise<VerificationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const stages = {
            brand: false,
            identity: false,
            logistics: false,
            compatibility: false,
            completeness: false,
            consistency: false,
            attribution: false,
            deduplication: false
        };

        // Stage 1: Brand (Basic Sanity)
        const knownBrands = ['HP', 'Canon', 'Kyocera', 'Xerox', 'Brother', 'Samsung', 'Ricoh', 'Pantum', 'Konica Minolta', 'OKI', 'Lexmark', 'Epson', 'Cactus', 'Sakura', 'Uniterm'];
        if (data.brand && knownBrands.some(b => data.brand?.toUpperCase().includes(b.toUpperCase()))) {
            stages.brand = true;
        } else {
            // Not a hard error, maybe a new brand
            warnings.push(`Brand '${data.brand}' not in common list`);
        }

        // Stage 2: Identity (Critical but allow partials)
        if (data.mpn_identity?.mpn && data.mpn_identity.mpn.length > 2) {
            stages.identity = true;
        } else {
            // RELAXED: Moved from Error to Warning. We can often recover MPN later or manually.
            warnings.push("MISSING_MPN: Product identified by name only");
        }

        // Stage 3: Consistency (Physical & Logical)
        let consistencyPass = true;

        // 3a. Weight vs Dimensions
        const hasWeight = !!(data.packaging_from_nix?.weight_g || (data as any).packaging?.package_weight_g || (data as any).logistics?.weight);
        const hasDims = !!(data.packaging_from_nix?.width_mm || (data as any).logistics?.dimensions);

        if (hasDims && !hasWeight) {
            warnings.push("INCONSISTENT_LOGISTICS: Dimensions exist but weight is missing");
            // consistencyPass = false; // Don't fail consistency for this
        }

        stages.consistency = consistencyPass;


        // Stage 4: Logistics
        if (hasWeight || hasDims) {
            stages.logistics = true;
        } else {
            warnings.push("MISSING_LOGISTICS: Weight/Dimensions not found");
        }

        // Stage 5: Compatibility (RU Market Consensus)
        if (data.compatible_printers_ru && data.compatible_printers_ru.length > 0) {
            stages.compatibility = true;
        } else if ((data as any).compatibility_ru?.printers && (data as any).compatibility_ru.printers.length > 0) {
            stages.compatibility = true;
        } else {
            // RELAXED: Warning only.
            warnings.push("MISSING_COMPATIBILITY: No compatible printers found");
        }

        // Stage 6: Attribution
        const hasIdentityEvidence = !!(data._evidence?.mpn_identity || data._evidence?.['mpn']);
        const hasCompatEvidence = !!(data._evidence?.compatible_printers_ru || data._evidence?.['compatibility_ru']);

        let attributionPass = true;
        if (!hasIdentityEvidence) { attributionPass = false; warnings.push("UNATTRIBUTED: Identity"); }
        if (!hasCompatEvidence && stages.compatibility) { attributionPass = false; warnings.push("UNATTRIBUTED: Compatibility"); }

        stages.attribution = attributionPass;


        // Stage 7: Completeness (Multi-Source Corroboration)
        let uniqueDomains = new Set<string>();
        if (data._evidence) {
            Object.values(data._evidence).forEach((e: any) => {
                if (e.source_url) {
                    try {
                        const url = new URL(e.source_url);
                        uniqueDomains.add(url.hostname);
                    } catch (e) { /* ignore */ }
                }
            });
        }

        if (uniqueDomains.size >= 2) {
            stages.completeness = true;
        } else if (uniqueDomains.size === 1) {
            warnings.push("SINGLE_SOURCE: Data relies on a single domain");
        } else {
            warnings.push("NO_SOURCES: Data has no verifiable sources");
        }


        // Stage 8: Duplicate Check (Advisory)
        stages.deduplication = true;
        if (data.mpn_identity?.mpn) {
            try {
                // Dynamic import to avoid cycles/mocking issues in strict unit tests if needed
                const duplicate = await import("../backend/DeduplicationService.js").then(m =>
                    m.DeduplicationService.findPotentialDuplicate(data.mpn_identity!.mpn!)
                ).catch(() => null);

                if (duplicate) {
                    warnings.push(`POSSIBLE_DUPLICATE: Found similar item ${duplicate.id}`);
                    stages.deduplication = false;
                }
            } catch (e) { console.warn("Dedupe check failed silently", e); }
        }


        // Scoring
        let score = 0;
        if (stages.brand) score += 5;
        if (stages.identity) score += 30; // Boosted
        if (stages.logistics) score += 10;
        if (stages.compatibility) score += 30; // Boosted
        if (stages.attribution) score += 15;
        if (stages.completeness) score += 10;

        // Final Gate
        // Relaxed: As long as we have Identity OR Compatibility, it's valid enough to show.
        // It will be "needs_review" if score < 80 or if there are warnings, but "isValid" basically means "Not Junk".
        const isValid = (stages.identity || stages.compatibility) && uniqueDomains.size > 0;

        return {
            isValid,
            score,
            errors, // Should be empty now unless something catastrophic
            warnings,
            stages
        };
    }
}
