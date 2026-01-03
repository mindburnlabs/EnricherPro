import fs from 'node:fs';
import path from 'node:path';
import { MODEL_SELECTOR_CONFIGS, ModelProfile } from '../src/config/model_selectors.ts';
import type { ModelSelector } from '../src/config/model_selectors.ts';

type ORModel = {
    id: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string; input?: string; output?: string };
};

function toNum(x: unknown): number | null {
    if (typeof x === 'number') return x;
    if (typeof x === 'string') {
        const n = Number(x);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function scoreModel(m: ORModel, strategy: string): number {
    const ctx = m.context_length ?? 0;
    const pIn = toNum((m.pricing as any)?.prompt ?? (m.pricing as any)?.input) ?? Number.POSITIVE_INFINITY;
    const pOut = toNum((m.pricing as any)?.completion ?? (m.pricing as any)?.output) ?? Number.POSITIVE_INFINITY;

    if (strategy === 'largest_context') return ctx;
    if (strategy === 'cheapest_input') return -pIn;
    if (strategy === 'cheapest_total') return -(pIn + pOut);
    return 0;
}

function pickMatches(models: ORModel[], sel: Extract<ModelSelector, { kind: 'pattern' }>): ORModel[] {
    const re = new RegExp(sel.regex);
    const matches = models.filter(m => re.test(m.id));

    if (sel.strategy === 'latest') {
        matches.sort((a, b) => (a.id < b.id ? 1 : -1));
    } else {
        matches.sort((a, b) => scoreModel(b, sel.strategy) - scoreModel(a, sel.strategy));
    }

    return matches.slice(0, sel.limit ?? 1);
}

async function fetchJson(url: string, apiKey?: string) {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
    return res.json();
}

async function main() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log('Fetching OpenRouter models...');
    const payload = await fetchJson('https://openrouter.ai/api/v1/models', apiKey);
    const models: ORModel[] = Array.isArray(payload?.data) ? payload.data : [];
    console.log(`Found ${models.length} models.`);

    const out: Record<string, { candidates: string[]; description: string }> = {};

    for (const profile of Object.values(ModelProfile)) {
        const cfg = MODEL_SELECTOR_CONFIGS[profile];
        const candidates: string[] = [];

        for (const s of cfg.selectors) {
            if (s.kind === 'auto') {
                candidates.push(s.id);
                continue;
            }

            if (s.kind === 'exact') {
                if (models.some(m => m.id === s.id)) candidates.push(s.id);
                continue;
            }

            if (s.kind === 'pattern') {
                const picked = pickMatches(models, s);
                for (const m of picked) candidates.push(m.id);
                continue;
            }
        }

        out[profile] = { candidates: [...new Set(candidates)], description: cfg.description };
    }

    const file = `/* eslint-disable */
/**
 * AUTO-GENERATED FILE.
 * Source: src/config/model_selectors.ts
 * Regenerate: pnpm gen:models
 */
import { ModelProfile } from './model_selectors.js';

export const MODEL_CONFIGS = ${JSON.stringify(out, null, 2)} as const;

export const MODEL_TIERS = {
  A: ModelProfile.FAST_CHEAP,
  B: ModelProfile.PLANNING,
  C: ModelProfile.REASONING
} as const;

export const DEFAULT_MODEL = 'openrouter/auto';
`;

    // Path adjusted since we are in scripts/
    const outPath = path.join(process.cwd(), 'src/config/models.generated.ts');
    fs.writeFileSync(outPath, file, 'utf8');
    console.log(`Wrote ${outPath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
