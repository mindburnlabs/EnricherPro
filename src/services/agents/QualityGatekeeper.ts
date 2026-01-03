
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

    static async validate(data: Partial<StrictConsumableData>, language: string = 'en'): Promise<VerificationResult> {
        const isRu = language === 'ru';
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

        const MSG = {
            BRAND_UNKNOWN: isRu ? `Бренд '${data.brand}' не найден в списке известных` : `Brand '${data.brand}' not in common list`,
            MISSING_MPN: isRu ? "ОТСУТСТВУЕТ_АРТИКУЛ: Продукт идентифицирован только по имени" : "MISSING_MPN: Product identified by name only",
            INCONSISTENT_LOGISTICS: isRu ? "НЕСООТВЕТСТВИЕ_ЛОГИСТИКИ: Есть габариты, но нет веса" : "INCONSISTENT_LOGISTICS: Dimensions exist but weight is missing",
            MISSING_LOGISTICS: isRu ? "НЕТ_ЛОГИСТИКИ: Вес/Габариты не найдены (NIX.ru)" : "MISSING_LOGISTICS: Weight/Dimensions not found",
            MISSING_COMPATIBILITY: isRu ? "НЕТ_СОВМЕСТИМОСТИ: Принтеры не найдены" : "MISSING_COMPATIBILITY: No compatible printers found",
            UNATTRIBUTED_ID: isRu ? "НЕТ_ИСТОЧНИКА: Идентификация" : "UNATTRIBUTED: Identity",
            UNATTRIBUTED_COMPAT: isRu ? "НЕТ_ИСТОЧНИКА: Совместимость" : "UNATTRIBUTED: Compatibility",
            SINGLE_SOURCE: isRu ? "ОДИН_ИСТОЧНИК: Данные из одного магазина без подтверждения" : "SINGLE_SOURCE: Data relies on a single retail source without official verification",
            NO_SOURCES: isRu ? "НЕТ_ИСТОЧНИКОВ: Данные не подтверждены" : "NO_SOURCES: Data has no verifiable sources",
            POSSIBLE_DUPLICATE: isRu ? "ВОЗМОЖНЫЙ_ДУБЛИКАТ: Найден похожий товар" : "POSSIBLE_DUPLICATE: Found similar item",
            STRICT_FAIL_LOGISTICS: isRu ? "СТРОГИЙ_ОТКАЗ: Нет Веса/Габаритов" : "STRICT_FAIL: Missing Weight/Dims",
            STRICT_FAIL_COMPAT: isRu ? "СТРОГИЙ_ОТКАЗ: Нет Совместимости" : "STRICT_FAIL: Missing Compatibility",
            STRICT_FAIL_SOURCES: isRu ? "СТРОГИЙ_ОТКАЗ: Недостаточно источников" : "STRICT_FAIL: Insufficient Sources"
        };

        // Stage 1: Brand (Basic Sanity)
        const knownBrands = ['HP', 'Canon', 'Kyocera', 'Xerox', 'Brother', 'Samsung', 'Ricoh', 'Pantum', 'Konica Minolta', 'OKI', 'Lexmark', 'Epson', 'Cactus', 'Sakura', 'Uniterm'];
        if (data.brand && knownBrands.some(b => data.brand?.toUpperCase().includes(b.toUpperCase()))) {
            stages.brand = true;
        } else {
            warnings.push(MSG.BRAND_UNKNOWN);
        }

        // Stage 2: Identity (Critical but allow partials)
        if (data.mpn_identity?.mpn && data.mpn_identity.mpn.length > 2) {
            stages.identity = true;
        } else {
            warnings.push(MSG.MISSING_MPN);
        }

        // Stage 3: Consistency (Physical & Logical)
        let consistencyPass = true;

        // 3a. Weight vs Dimensions
        const hasWeight = !!(data.packaging_from_nix?.weight_g || (data as any).packaging?.package_weight_g || (data as any).logistics?.weight);
        const hasDims = !!(data.packaging_from_nix?.width_mm || (data as any).logistics?.dimensions);

        if (hasDims && !hasWeight) {
            warnings.push(MSG.INCONSISTENT_LOGISTICS);
        }

        stages.consistency = consistencyPass;


        // Stage 4: Logistics
        if (hasWeight || hasDims) {
            stages.logistics = true;
        } else {
            warnings.push(MSG.MISSING_LOGISTICS);
        }

        // Stage 5: Compatibility (RU Market Consensus)
        if (data.compatible_printers_ru && Array.isArray(data.compatible_printers_ru) && data.compatible_printers_ru.length > 0) {
            stages.compatibility = true;
        } else if ((data as any).compatibility_ru?.printers && Array.isArray((data as any).compatibility_ru.printers) && (data as any).compatibility_ru.printers.length > 0) {
            stages.compatibility = true;
        } else {
            warnings.push(MSG.MISSING_COMPATIBILITY);
        }

        // Stage 6: Attribution
        const hasIdentityEvidence = !!(data._evidence?.mpn_identity || data._evidence?.['mpn']);
        const hasCompatEvidence = !!(data._evidence?.compatible_printers_ru || data._evidence?.['compatibility_ru']);

        let attributionPass = true;
        if (!hasIdentityEvidence) { attributionPass = false; warnings.push(MSG.UNATTRIBUTED_ID); }
        if (!hasCompatEvidence && stages.compatibility) { attributionPass = false; warnings.push(MSG.UNATTRIBUTED_COMPAT); }

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

        const isOfficialOrNix = uniqueDomains.size > 0 && Array.from(uniqueDomains).some(d =>
            d.includes('hp.com') || d.includes('canon') || d.includes('kyocera') || d.includes('nix.ru') || d.includes('dns-shop')
        );

        if (uniqueDomains.size >= 2 || isOfficialOrNix) {
            stages.completeness = true;
        } else if (uniqueDomains.size === 1) {
            warnings.push(MSG.SINGLE_SOURCE);
        } else {
            warnings.push(MSG.NO_SOURCES);
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
                    warnings.push(`${MSG.POSSIBLE_DUPLICATE}: ${duplicate.id}`);
                    stages.deduplication = false;
                }
            } catch (e) { console.warn("Dedupe check failed silently", e); }
        }


        // Scoring
        let score = 0;
        if (stages.brand) score += 5;
        if (stages.identity) score += 30; // Boosted
        if (stages.logistics) score += 20; // Critical for logistics
        if (stages.compatibility) score += 20; // Critical for usage
        if (stages.attribution) score += 15;
        if (stages.completeness) score += 10;

        // Final Gate - STRICT
        // Must have: Identity AND Logistics AND Compatibility AND (Completeness OR Official Source)
        const isValid = stages.identity && stages.logistics && stages.compatibility && stages.completeness;

        // If not valid, explain broadly
        if (!isValid && warnings.length === 0) {
            if (!stages.logistics) warnings.push(MSG.STRICT_FAIL_LOGISTICS);
            if (!stages.compatibility) warnings.push(MSG.STRICT_FAIL_COMPAT);
            if (!stages.completeness) warnings.push(MSG.STRICT_FAIL_SOURCES);
        }

        return {
            isValid,
            score,
            errors, // Should be empty now unless something catastrophic
            warnings,
            stages
        };
    }
}
