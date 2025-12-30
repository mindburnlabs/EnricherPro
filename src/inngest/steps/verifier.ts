
import { StrictConsumableData, ConsumableData } from '../../types/domain';

export async function verifierStep(data: Partial<ConsumableData>) {
    // Rule-based verification (Server Side)
    const validationErrors: string[] = [];

    // 1. Check Identity
    if (!data.mpn_identity?.mpn) {
        validationErrors.push("MISSING_MPN");
    }

    // 2. Check Critical Fields
    if (!data.yield?.value) {
        validationErrors.push("MISSING_YIELD");
    }

    // 3. Check Consistency
    // e.g. if OEM is "HP", brand should be "HP"

    return {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        score: 100 - (validationErrors.length * 20)
    };
}
