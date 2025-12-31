
import { StrictConsumableData } from '../../types/domain';

export interface VerificationResult {
    isValid: boolean;
    score: number;
    errors: string[];
    warnings: string[];
    stages: {
        brand: boolean;
        identity: boolean;
        logistics: boolean;
        compatibility: boolean;
        completeness: boolean;
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
            completeness: false
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

        // Stage 3: Logistics (NIX.ru requirement)
        // We check if specifically packaging data is present
        // Support both old and new schema locations just in case, but prefer strict schema
        if (data.packaging_from_nix?.weight_g || (data as any).packaging?.package_weight_g || (data as any).logistics?.weight) {
            stages.logistics = true;
        } else {
            // Not a hard error for 'published', but reduces score
            warnings.push("MISSING_LOGISTICS: Weight/Dimensions not found");
        }

        // Stage 4: Compatibility (RU Market Consensus)
        if (data.compatible_printers_ru && data.compatible_printers_ru.length > 0) {
            stages.compatibility = true;
        } else if ((data as any).compatibility_ru?.printers && (data as any).compatibility_ru.printers.length > 0) {
            stages.compatibility = true;
        } else {
            errors.push("MISSING_COMPATIBILITY: No compatible printers found");
        }

        // Stage 5: Completeness (Full Evidence Check)
        // Check if critical fields have evidence
        const hasEvidence = data._evidence &&
            data._evidence.brand &&
            (data._evidence.compatible_printers_ru || data._evidence['compatibility_ru']);

        if (hasEvidence) {
            stages.completeness = true;
        } else {
            warnings.push("WEAK_EVIDENCE: Critical fields lack citation");
        }

        // Scoring
        let score = 0;
        if (stages.brand) score += 10;
        if (stages.identity) score += 40; // High weight
        if (stages.logistics) score += 10;
        if (stages.compatibility) score += 30;
        if (stages.completeness) score += 10;

        // Final Gate
        // Must have Identity and Compatibility to be "Published"
        const isValid = stages.identity && stages.compatibility;

        return {
            isValid,
            score,
            errors,
            warnings,
            stages
        };
    }
}
