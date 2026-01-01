export const safeJsonParse = <T = any>(text: string, fallback: T | null = null): T => {
    try {
        // Strip Markdown Code Blocks
        let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Strip Common "Note:" or generic conversational text if mostly code
        // Simple heuristic: If it starts with "Here is", find the first { or [
        const firstBrace = clean.indexOf('{');
        const firstBracket = clean.indexOf('[');

        let startIdx = 0;
        if (firstBrace > -1 && firstBracket > -1) {
            startIdx = Math.min(firstBrace, firstBracket);
        } else if (firstBrace > -1) {
            startIdx = firstBrace;
        } else if (firstBracket > -1) {
            startIdx = firstBracket;
        }

        if (startIdx > 0) {
            clean = clean.substring(startIdx);
        }

        // Handle trailing text
        const lastBrace = clean.lastIndexOf('}');
        const lastBracket = clean.lastIndexOf(']');
        let endIdx = clean.length;

        if (lastBrace > -1 && lastBracket > -1) {
            endIdx = Math.max(lastBrace, lastBracket) + 1;
        } else if (lastBrace > -1) {
            endIdx = lastBrace + 1;
        } else if (lastBracket > -1) {
            endIdx = lastBracket + 1;
        }

        if (endIdx < clean.length) {
            clean = clean.substring(0, endIdx);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.warn("safeJsonParse failed on:", text.substring(0, 100) + "...");
        if (fallback !== null) return fallback;
        throw e;
    }
};
