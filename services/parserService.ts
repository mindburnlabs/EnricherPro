import { ConsumableData, ConsumableType, AutomationStatus, YieldUnit } from '../types/domain';
import { NormalizationService } from './normalizationService';

export class ParserService {

    static parse(rawTitle: string, normalizedTitle: string): Partial<ConsumableData> {
        const result: Partial<ConsumableData> = {
            supplier_title_raw: rawTitle,
            title_norm: normalizedTitle,
            automation_status: 'done',
            mpn_identity: {
                mpn: '',
                canonical_model_name: '',
                variant_flags: {
                    chip: false,
                    counterless: false,
                    high_yield: false,
                    kit: false
                }
            },
            normalization_log: []
        };

        // 1. EXTRACT MODEL
        const { model, candidates } = this.extractModel(normalizedTitle);
        if (model) {
            result.mpn_identity!.mpn = model;
            result.mpn_identity!.canonical_model_name = model;
            result.model = model;
            result.short_model = model;
        } else {
            result.automation_status = 'failed';
            result.validation_errors = ['failed_parse_model'];
        }

        // 2. EXTRACT BRAND
        const branding = this.extractBrand(normalizedTitle, model);
        result.brand = branding.brand;
        if (!result.brand && result.automation_status !== 'failed') {
            result.automation_status = 'failed';
            result.validation_errors = [...(result.validation_errors || []), 'failed_parse_brand'];
        }

        // 3. EXTRACT TYPE
        result.consumable_type = this.extractType(normalizedTitle, model);
        if (result.consumable_type === 'unknown' && result.automation_status !== 'failed') {
            result.automation_status = 'needs_review';
            result.missing_fields = [...(result.missing_fields || []), 'consumable_type'];
        }

        // 4. RESOURCE (Yield)
        result.yield = this.extractYield(normalizedTitle);

        // 5. COLOR
        result.color = this.extractColor(normalizedTitle);

        // 6. CHIP / COUNTER
        const flags = this.extractFlags(normalizedTitle);
        result.has_chip = flags.has_chip;
        result.has_page_counter = flags.has_page_counter;
        if (result.mpn_identity) {
            result.mpn_identity.variant_flags.chip = flags.has_chip === true;
            result.mpn_identity.variant_flags.counterless = flags.has_page_counter === false;
        }

        // 7. PRINTER CANDIDATES
        const printerCandidates = this.extractPrinterCandidates(normalizedTitle);
        // Stored for orchestration to usage

        return result;
    }

    private static extractModel(title: string): { model: string | null, candidates: string[] } {
        // Cut off everything after "for" / "для" to avoid picking printer models
        const cutoffRegex = /(?:\s+for\s+|\s+для\s+).*/i;
        const mainPart = title.replace(cutoffRegex, '');

        // Remove known noise words
        let cleaned = mainPart.replace(/toner_cartridge|drum_unit|cartridge|black|cyan|magenta|yellow/gi, '');

        const tokenRegex = /\b[A-Z0-9\-\.]{2,}\b/gi;
        const potential = cleaned.match(tokenRegex) || [];

        const brands = ['HP', 'CANON', 'KYOCERA', 'BROTHER', 'XEROX', 'RICOH', 'SAMSUNG', 'PANTUM', 'KONICA', 'LENOVO', 'OKI', 'LEXMARK', 'EPSON'];

        const candidates = potential.filter(t => {
            if (/^\d{4,}$/.test(t)) return false; // purely numeric > 4 digits is often yield
            if (t.length < 2) return false;
            if (brands.includes(t.toUpperCase())) return false;
            if (/^for$/i.test(t) || /^для$/i.test(t)) return false;
            return true;
        });

        candidates.sort((a, b) => {
            const aScore = this.scoreModelCandidate(a);
            const bScore = this.scoreModelCandidate(b);
            return bScore - aScore;
        });

        return {
            model: candidates.length > 0 ? candidates[0] : null,
            candidates
        };
    }

    private static scoreModelCandidate(c: string): number {
        let score = 0;
        if (/^[WQ]\d+/.test(c)) score += 5; // HP Q2612A, W1331X
        if (/^TK\-\d+/.test(c)) score += 5; // Kyocera
        if (/^CF\d+/.test(c)) score += 5;
        if (/^MLT\-[A-Z]\d+/.test(c)) score += 5;
        if (/^\d{3,}$/.test(c) && !/^\d+00$/.test(c)) score += 2; // Canon 045, 054 etc

        if (/[A-Z]/.test(c) && /\d/.test(c)) score += 3;
        if (c.length >= 2 && c.length <= 10) score += 1;
        return score;
    }

    private static extractBrand(title: string, model: string | null): { brand: string | null } {
        const brands = ['HP', 'Canon', 'Kyocera', 'Brother', 'Xerox', 'Ricoh', 'Samsung', 'Pantum', 'Konica', 'Lenovo', 'OKI', 'Lexmark', 'Epson'];
        const titleUpper = title.toUpperCase();
        for (const b of brands) {
            if (titleUpper.includes(b.toUpperCase())) return { brand: b };
        }
        if (model) {
            if (/^Q|W|CF|CB|CE/.test(model)) return { brand: 'HP' };
            if (/^TK\-/.test(model)) return { brand: 'Kyocera' };
            if (/^CRG|0\d{2}/.test(model)) return { brand: 'Canon' };
            if (/^TN\-/.test(model)) return { brand: 'Brother' };
            if (/^MLT|ML/.test(model)) return { brand: 'Samsung' };
        }
        return { brand: null };
    }

    private static extractType(title: string, model: string | null): ConsumableType {
        const lower = title.toLowerCase();

        if (lower.includes('drum_unit') || lower.includes('drumunit') || lower.includes('фотобарабан')) return 'drum_unit';
        if (lower.includes('toner_cartridge') || lower.includes('tonercartridge') || lower.includes('тонер')) return 'toner_cartridge';
        if (lower.includes('ink_cartridge')) return 'ink_cartridge';

        if (model) {
            if (/^DK\-/.test(model)) return 'drum_unit';
            if (/^DR\-/.test(model)) return 'drum_unit';
            if (/^[WQ]\d+/.test(model)) return 'toner_cartridge';
            if (/^TK\-/.test(model)) return 'toner_cartridge';
            if (/^CF\d+/.test(model)) return 'toner_cartridge';
            if (/^TN\-/.test(model)) return 'toner_cartridge';
            if (/^MLT/.test(model)) return 'toner_cartridge';
            // Canon
            if (/^CRG/.test(model)) return 'toner_cartridge';
        }

        if (lower.includes('cartridge') || lower.includes('картридж')) return 'toner_cartridge';

        return 'unknown';
    }

    private static extractYield(title: string): YieldUnit extends string ? { value: number, unit: any } | null : null {
        // 1. Strict pattern
        const strictMatch = title.match(/(\d+)\s*(pages|copies|стр|копий)/i);
        if (strictMatch) {
            const val = parseInt(strictMatch[1]);
            const unit = (strictMatch[2].startsWith('cop') || strictMatch[2].startsWith('коп')) ? 'copies' : 'pages';
            return { value: val, unit };
        }

        // 2. Loose heuristics for common yield numbers (e.g. 15000)
        // Must be large number not part of model. 
        // We scan for stand-alone numbers.
        const matches = title.match(/\b(\d{3,6})\b/g);
        if (matches) {
            for (const m of matches) {
                const val = parseInt(m);
                // Common yield values often end in 00 or 000
                if (val >= 1000 && val % 100 === 0) {
                    return { value: val, unit: 'pages' };
                }
            }
        }

        return null;
    }

    private static extractColor(title: string): string | null {
        if (title.includes('Black')) return 'Black';
        if (title.includes('Cyan')) return 'Cyan';
        if (title.includes('Magenta')) return 'Magenta';
        if (title.includes('Yellow')) return 'Yellow';
        return null;
    }

    private static extractFlags(title: string): { has_chip: boolean | 'unknown', has_page_counter: boolean | 'unknown' } {
        const res: { has_chip: boolean | 'unknown', has_page_counter: boolean | 'unknown' } = {
            has_chip: 'unknown',
            has_page_counter: 'unknown'
        };
        const upper = title.toUpperCase();

        if (upper.includes('С ЧИПОМ') || upper.includes('WITH CHIP')) res.has_chip = true;
        if (upper.includes('БЕЗ ЧИПА') || upper.includes('WITHOUT CHIP') || upper.includes('NO CHIP')) res.has_chip = false;

        // Match "БЕЗ" followed by space?, then "СЧЕТЧИК"
        // Using explicit hex check or dot for safety on E/T characters which are homoglyphs
        // \u0422 = Cyrillic Capital Te, \u0054 = Latin T
        // \u0421 = Cyrillic Capital Es, \u0043 = Latin C

        const counterRegex = /БЕЗ\s*[CС]Ч[ЕЁE][TТ]ЧИ/i;

        if (counterRegex.test(upper) || upper.includes('WITHOUT COUNTER') || upper.includes('БЕЗ СЧЕТЧИКА')) res.has_page_counter = false;

        return res;
    }

    private static extractPrinterCandidates(title: string): string[] {
        const match = title.match(/(?:for|для)\s+(.+)$/i);
        if (!match) return [];
        const candidatesString = match[1];
        return candidatesString.split('/').map(s => s.trim()).filter(s => s.length > 0);
    }
}
