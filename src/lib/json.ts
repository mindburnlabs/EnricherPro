export const safeJsonParse = <T = any>(text: string, fallback: T | null = null): T => {
    try {
        // Strip Markdown Code Blocks
        let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Strip Common "Note:" or generic conversational text if mostly code
        // Simple heuristic: If it starts with "Here is", find the first { or [
        // Type-aware Bracket Matching
        const firstBrace = clean.indexOf('{');
        const firstBracket = clean.indexOf('[');

        // Determine type based on what comes first
        let isObject = false;
        let startIdx = -1;

        // If both exist
        if (firstBrace > -1 && firstBracket > -1) {
            if (firstBrace < firstBracket) {
                isObject = true;
                startIdx = firstBrace;
            } else {
                isObject = false;
                startIdx = firstBracket;
            }
        } else if (firstBrace > -1) {
            isObject = true;
            startIdx = firstBrace;
        } else if (firstBracket > -1) {
            isObject = false;
            startIdx = firstBracket;
        }

        if (startIdx > -1) {
            clean = clean.substring(startIdx);

            // Re-calculate end index based on type
            const lastBrace = clean.lastIndexOf('}');
            const lastBracket = clean.lastIndexOf(']');

            let endIdx = clean.length;

            if (isObject && lastBrace > -1) {
                endIdx = lastBrace + 1;
            } else if (!isObject && lastBracket > -1) {
                endIdx = lastBracket + 1;
            }

            clean = clean.substring(0, endIdx);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.warn("safeJsonParse failed on:", text.substring(0, 100) + "...");
        if (fallback !== null) return fallback;
        throw e;
    }
};
