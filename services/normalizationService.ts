
export class NormalizationService {

    /**
     * Main entry point for normalizing the input title.
     * Does NOT modify the original raw title (supplier_title_raw).
     */
    static normalizeTitle(raw: string): string {
        if (!raw) return '';

        let norm = raw;

        // 1. Unicode Normalization (NFC)
        norm = norm.normalize('NFC');

        // 2. Remove double spaces and non-breaking spaces
        norm = norm.replace(/\s+/g, ' ').trim();
        norm = norm.replace(/\u00A0/g, ' ');

        // 3. Unify separators
        // Replace commas, semicolons, pipe, backslash with forward slash
        norm = norm.replace(/[,;\\|]/g, '/');

        // 4. Normalize Resource (Yield)
        // 15K, 15k, 15 K, 15 к, 15К -> 15000
        norm = norm.replace(/(\d+)\s*[kкКK]/g, (match, num) => {
            return `${parseInt(num) * 1000}`;
        });

        // 5. Normalize Consumable Type
        const typeReplacements: Record<string, string> = {
            'драм-картридж': 'drum_unit',
            'фотобарабан': 'drum_unit',
            'drum unit': 'drum_unit',
            'drum': 'drum_unit',
            'картридж': 'toner_cartridge',
            'тонер': 'toner_cartridge',
            'toner cartridge': 'toner_cartridge'
        };

        // We replace known type keywords with standard ones? 
        // Or do we just clean them up? TZ says "Normalize type ... -> drum_unit"
        // But usually we extract type, not replace it in title. 
        // The TZ says "Prerequisite for parse". So let's replace them to standard English tokens 
        // to make parsing easier, but keep it readable.
        // Actually, let's keep the title readable but normalized.
        // The TZ Example 3: "title_norm - working version for parse".
        // Let's standardise the keywords to English for easier Regex later.

        for (const [key, value] of Object.entries(typeReplacements)) {
            const regex = new RegExp(key, 'gi');
            norm = norm.replace(regex, value);
        }

        // 6. Normalize Color
        const colorReplacements: Record<string, string> = {
            'Bk': 'Black',
            'Черный': 'Black',
            'Чёрный': 'Black',
            'C': 'Cyan',
            'Голубой': 'Cyan',
            'M': 'Magenta',
            'Пурпурный': 'Magenta',
            'Y': 'Yellow',
            'Желтый': 'Yellow',
            'Жёлтый': 'Yellow'
            // 'K' is dangerous as a standalone (could be in model name), handle contextually in parser,
            // or if explicitly separated like " / K / "
        };

        // Use word boundaries for short keys like 'C', 'M', 'Y', 'Bk'
        for (const [key, value] of Object.entries(colorReplacements)) {
            // "Boundaries" in Russian text can be tricky.
            // Let's look for explicitly delimited or space-separated
            const regex = new RegExp(`(^|\\s|/)${key}($|\\s|/)`, 'gi');
            norm = norm.replace(regex, `$1${value}$2`);
        }

        return norm.trim();
    }
}
