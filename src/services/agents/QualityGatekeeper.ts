
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
        const knownBrands = ['HP', 'Canon', 'Kyocera', 'Xerox', 'Brother', 'Samsung', 'Ricoh', 'Pantum', 'Konica Minolta', 'OKI', 'Lexmark', 'Epson'];
        if (data.brand && knownBrands.some(b => data.brand?.toUpperCase().includes(b.toUpperCase()))) {
            stages.brand = true;
        } else {
            warnings.push("Brand unknown or missing");
        }

        // Stage 2: Identity (Critical)
        if (data.mpn_identity?.mpn && data.mpn_identity.mpn.length > 3) {
            stages.identity = true;
        } else {
            errors.push("MISSING_MPN: Cannot identify product");
        }

        // Stage 3: Consistency (Physical & Logical)
        let consistencyPass = true;

        // 3a. Weight vs Dimensions
        const hasWeight = !!(data.packaging_from_nix?.weight_g || (data as any).packaging?.package_weight_g || (data as any).logistics?.weight);
        const hasDims = !!(data.packaging_from_nix?.width_mm || (data as any).logistics?.dimensions);

        if (hasDims && !hasWeight) {
            warnings.push("INCONSISTENT_LOGISTICS: Dimensions exist but weight is missing");
            consistencyPass = false;
        }

        // 3b. Connectivity Matches Ports (Heuristic)
        const connectivity = (data.connectivity?.connection_interfaces || []).join(" ").toLowerCase();
        if (connectivity.includes("ethernet") || connectivity.includes("lan")) {
            const ports = (data.connectivity?.ports || []).join(" ").toLowerCase();
            if (!ports.includes("rj-45") && !ports.includes("rj45") && !ports.includes("ethernet")) {
                // Not a hard fail, but suspicious
                // warnings.push("INCONSISTENT_CONNECTIVITY: Claims LAN but missing RJ-45 port"); 
            }
        }
        stages.consistency = consistencyPass;


        // Stage 4: Logistics (NIX.ru requirement)
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
            errors.push("MISSING_COMPATIBILITY: No compatible printers found");
        }

        // Stage 6: Attribution (Strict Evidence Linking)
        // Check if critical fields (Identity, Compatibility, Specs) have evidence
        const hasIdentityEvidence = !!(data._evidence?.mpn_identity || data._evidence?.['mpn']);
        const hasCompatEvidence = !!(data._evidence?.compatible_printers_ru || data._evidence?.['compatibility_ru']);

        let attributionPass = true;
        if (!hasIdentityEvidence) { attributionPass = false; warnings.push("UNATTRIBUTED: Identity"); }
        if (!hasCompatEvidence) { attributionPass = false; warnings.push("UNATTRIBUTED: Compatibility"); }

        stages.attribution = attributionPass;


        // Stage 7: Completeness (Multi-Source Corroboration)
        let uniqueDomains = new Set<string>();
        if (data._evidence) {
            Object.values(data._evidence).forEach((e: any) => {
                if (e.source_url) {
                    try {
                        const url = new URL(e.source_url);
                        uniqueDomains.add(url.hostname);
                    } catch (e) { /* ignore invalid url */ }
                }
            });
        }

        if (attributionPass && uniqueDomains.size >= 2) {
            stages.completeness = true;
        } else if (attributionPass && uniqueDomains.size < 2) {
            warnings.push("SINGLE_SOURCE: Data relies on a single domain");
        }


        // Stage 8: Final Deduplication Guard
        // We only check if we have a valid MPN
        stages.deduplication = true;
        if (data.mpn_identity?.mpn) {
            const duplicate = await import("../backend/DeduplicationService.js").then(m =>
                m.DeduplicationService.findPotentialDuplicate(data.mpn_identity!.mpn!)
            );

            if (duplicate) {
                warnings.push(`POSSIBLE_DUPLICATE: Found similar item ${duplicate.id} (${duplicate.type})`);
                stages.deduplication = false;
            }
        }


        // Scoring
        let score = 0;
        if (stages.brand) score += 5;
        if (stages.identity) score += 20;
        if (stages.logistics) score += 10;
        if (stages.compatibility) score += 20;
        if (stages.consistency) score += 10;
        if (stages.attribution) score += 20;
        if (stages.completeness) score += 10;
        if (stages.deduplication) score += 5;

        // Final Gate
        // Must have Identity, Compatibility, Attribution
        const isValid = stages.identity && stages.compatibility && stages.attribution;

        return {
            isValid,
            score,
            errors,
            warnings,
            stages
        };
    }
}
