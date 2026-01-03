
interface StrategyResult {
    strategyName: string;
    url?: string;
    html?: string;
    confidence: number;
    source: 'direct' | 'search' | 'cache';
}

type StrategyFunction = () => Promise<StrategyResult | null>;

export class StrategyRacer {
    /**
     * Races multiple strategies against each other.
     * The first strategy to return a RESULT (not null) wins.
     * If a strategy fails (throws or returns null), it is ignored unless all fail.
     */
    static async race(strategies: { name: string, fn: StrategyFunction }[]): Promise<StrategyResult | null> {
        return new Promise((resolve) => {
            let pending = strategies.length;
            let resolved = false;

            strategies.forEach(async (strategy) => {
                try {
                    const result = await strategy.fn();
                    if (result && !resolved) {
                        // Validate result simply (must have URL or HTML)
                        if (result.url || result.html) {
                            resolved = true;
                            // console.log(`Hydra: Strategy '${strategy.name}' WON the race.`);
                            resolve(result);
                        }
                    }
                } catch (e) {
                    // console.warn(`Hydra: Strategy '${strategy.name}' failed:`, e);
                } finally {
                    pending--;
                    if (pending === 0 && !resolved) {
                        resolve(null); // All failed
                    }
                }
            });
        });
    }

    /**
     * Regex-based URL Guesser for common B2B sites.
     * This is "Head 1" of Hydra - extremely fast, low cost.
     */
    static guessUrl(query: string): string | null {
        // Simple heuristic patterns
        // HP
        if (/hp|hewlett/i.test(query)) {
            // Extract MPN
            const mpnMatch = query.match(/\b([A-Z0-9]{4,10})\b/);
            if (mpnMatch) {
                // Official HP Support is often hp.com/something/[mpn]
                // This is a naive guess, but works for checking if page exists
                // Better pattern: google "site:hp.com [mpn]" is fast but is still search
                // Direct guess:
                // return \`https://www.hp.com/us-en/shop/pdp/${mpnMatch[1]}\`; // Example
            }
        }
        return null;
    }
}
