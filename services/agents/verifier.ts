
import { StrictConsumableData } from '../../types/domain';

export interface VerificationResult {
    isValid: boolean;
    confidence: number;
    issues: string[];
    needsReview: boolean;
}

export class VerifierAgent {
    public verify(data: StrictConsumableData): VerificationResult {
        const issues: string[] = [];
        let confidence = 1.0;

        // 1. Logistics Check
        if (data.packaging) {
            // Check for realistic values
            if (data.packaging.package_weight_g > 5000) {
                issues.push('Weight seems excessive (>5kg) for a consumable');
                confidence -= 0.2;
            }
            if (data.packaging.package_mm.length > 1000 || data.packaging.package_mm.width > 1000) {
                issues.push('Dimensions seem excessive (>1m)');
                confidence -= 0.2;
            }
            if (!data.packaging.not_found_on_nix && data.packaging.evidence_urls.length === 0) {
                issues.push('Logistics data found but no evidence URL');
                confidence -= 0.3;
            }
        } else {
            // Missing logistics is handled by global status, but here we can flag it
            // confidence -= 0.1; 
        }

        // 2. Compatibility Consensus
        if (data.compatibility_ru) {
            if (data.compatibility_ru.needs_review) {
                issues.push(...data.compatibility_ru.exclusion_notes);
                confidence -= 0.3;
            }
            if (data.compatibility_ru.printers.length === 0) {
                issues.push('No compatible printers found');
                confidence -= 0.4;
            }
        }

        // 3. Cross-Field Validation
        // e.g. Mismatch between brand and model prefix
        if (data.brand && data.model) {
            const brand = data.brand.toLowerCase();
            const model = data.model.toLowerCase();
            if (brand === 'hp' && !model.match(/^(w|cf|q|ce|cb|cc|tn)/)) {
                // Not a strict error, but a warning?
            }
        }

        return {
            isValid: issues.length === 0 && confidence > 0.6,
            confidence,
            issues,
            needsReview: confidence < 0.9 || issues.length > 0
        };
    }
}

export const verifierAgent = new VerifierAgent();
