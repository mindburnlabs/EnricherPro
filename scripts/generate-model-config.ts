import fs from 'node:fs';
import path from 'node:path';
import { MODEL_SELECTOR_CONFIGS, ModelProfile } from '../src/config/model_selectors.ts';
import type { ModelSelector } from '../src/config/model_selectors.ts';

type ORModel = {
    id: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string; input?: string; output?: string; request?: string; image?: string };
};

function toNum(x: unknown): number | null {
    if (typeof x === 'number') return x;
    if (typeof x === 'string') {
        const n = Number(x);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function isFreeModel(m: ORModel): boolean {
    if (m.id.endsWith(':free')) return true;

    const pricing = m.pricing ?? {};
    const vals = [
        pricing.prompt ?? pricing.input,
        pricing.completion ?? pricing.output,
        pricing.request,
        pricing.image
    ].map(toNum).filter(v => v !== null) as number[];

    // If pricing is present and all provided components are zero, treat as free.
    return vals.length > 0 && vals.every(v => v === 0);
}

function scoreModel(m: ORModel, strategy: string): number {
    const ctx = m.context_length ?? 0;
    const pIn = toNum((m.pricing as any)?.prompt ?? (m.pricing as any)?.input) ?? Number.POSITIVE_INFINITY;
    const pOut = toNum((m.pricing as any)?.completion ?? (m.pricing as any)?.output) ?? Number.POSITIVE_INFINITY;

    if (strategy === 'largest_context') return ctx;
    if (strategy === 'cheapest_input') return -pIn;
    if (strategy === 'cheapest_total') return -(pIn + pOut);
    return 0; // "latest" handled via id sort
}

function sortMatches(matches: ORModel[], strategy: string): ORModel[] {
    const out = [...matches];
    if (strategy === 'latest') {
        out.sort((a, b) => (a.id < b.id ? 1 : -1));
    } else {
        out.sort((a, b) => scoreModel(b, strategy) - scoreModel(a, strategy));
    }
    return out;
}

function pickMatchesFreeFirst(
    models: ORModel[],
    regex: RegExp,
    strategy: 'latest' | 'cheapest_input' | 'cheapest_total' | 'largest_context',
    limit: number
): ORModel[] {
    const matches = models.filter(m => regex.test(m.id));

    const free = sortMatches(matches.filter(isFreeModel), strategy);
    const paid = sortMatches(matches.filter(m => !isFreeModel(m)), strategy);

    const preferFree = process.env.PREFER_FREE !== '0'; // default on
    const freeOnly = process.env.FREE_ONLY === '1';

    const ordered = preferFree ? [...free, ...paid] : [...paid, ...free];
    return (freeOnly ? free : ordered).slice(0, limit);
}

async function fetchJson(url: string, apiKey?: string) {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = 'https://enricher.pro'; // Good practice for OR
    headers['X-Title'] = 'EnricherPro Config Gen';

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

        const selectedModels: ORModel[] = [];
        const autoCandidates: string[] = [];

        for (const s of cfg.selectors) {
            if (s.kind === 'auto') {
                autoCandidates.push(s.id);
                continue;
            }

            if (s.kind === 'exact') {
                const m = models.find(m => m.id === s.id);
                if (m) selectedModels.push(m);
                continue;
            }

            if (s.kind === 'pattern') {
                const picked = pickMatchesFreeFirst(
                    models,
                    new RegExp(s.regex),
                    s.strategy,
                    s.limit ?? 1
                );
                selectedModels.push(...picked);
                continue;
            }
        }

        // Deduplicate by ID
        const uniqueModels = Array.from(new Set(selectedModels.map(m => m.id)))
            .map(id => selectedModels.find(m => m.id === id)!);

        // Global Sort: Free -> Paid
        const free = uniqueModels.filter(isFreeModel);
        const paid = uniqueModels.filter(m => !isFreeModel(m));

        const orderedCandidates = [
            ...free.map(m => m.id),
            ...paid.map(m => m.id),
            ...new Set(autoCandidates) // OpenRouter/auto always last
        ];

        out[profile] = { candidates: orderedCandidates, description: cfg.description };
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
