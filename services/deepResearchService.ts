import { firecrawlSearch, extractData, SearchOptions } from './firecrawlService';
import { processSupplierTitle } from './textProcessingService';
import {
    StrictConsumableData,
    AutomationStatus,
    FiresearchMeta,
    FiresearchParsed,
} from '../types/domain';
import { APP_CONFIG, getModeConfig, AppMode, SearchConfig } from './config';

export interface ResearchPlan {
    nix_queries: string[];
    compatibility_queries: string[];
    related_queries: string[];
    image_queries: string[];
    faq_queries: string[];
    logistics_needed: boolean;
    compatibility_needed: boolean;
    related_needed: boolean;
    images_needed: boolean;
    faq_needed: boolean;
    // Track if we need to expand search for consensus
    compatibility_tier_needed: 'oem_or_more_retailers' | 'none';
}

export interface DeepResearchResult {
    data: StrictConsumableData;
    logs: string[];
    status: AutomationStatus;
}

/**
 * Deep Research Service (Firesearch Implementation)
 * Orchestrates: Plan -> Discover -> Collect -> Extract -> Validate -> Loop
 */
export class DeepResearchService {
    private static instance: DeepResearchService;

    private constructor() { }

    public static getInstance(): DeepResearchService {
        if (!DeepResearchService.instance) {
            DeepResearchService.instance = new DeepResearchService();
        }
        return DeepResearchService.instance;
    }

    /**
     * Main Entry Point
     */
    public async executeWorkflow(query: string, mode: AppMode = 'standard', locale: string = 'RU', strictSources: boolean = true): Promise<DeepResearchResult> {
        const startTime = Date.now();
        // Dynamic Config Loading
        const { getModeConfig, getFiresearchOptions } = await import('./config');

        // Resolve Settings (User Pref > Props > Default)
        const firesearchOpts = getFiresearchOptions();
        const effectiveStrict = strictSources || firesearchOpts.strictSources;
        const config = getModeConfig(mode); // Will look up localStorage override for mode if active

        const logs: string[] = [];
        logs.push(`[DeepResearch] Starting workflow for: "${query}" in mode "${mode}" (Strict: ${effectiveStrict})`);

        const stats = {
            iterations: 0,
            sources_collected: 0,
            calls_made: 0,
            duration_ms: 0
        };

        // 1. Initial Parse
        const initialParse = processSupplierTitle(query);

        // Helper: Extract short model (aliases)
        // e.g. "CF217A" -> "17A", "Q2612A" -> "12A"
        const extractShortModel = (mpn: string): string[] => {
            const aliases: string[] = [];
            // Common pattern: 2-3 digits + 1-2 letters at end (standard HP/Canon style)
            const match = mpn.match(/(\d{2,4}[A-Z]{1,2})$/);
            if (match) aliases.push(match[1]);
            // Remove common prefixes 'CF', 'Q', 'CE', 'CB' if followed by digits
            const clean = mpn.replace(/^(CF|Q|CE|CB|CC|TN)/i, '');
            if (clean !== mpn && clean.length >= 2) aliases.push(clean);
            return [...new Set(aliases)];
        };
        const modelShort = initialParse.model.model ? extractShortModel(initialParse.model.model) : [];

        // Helper: Normalize Yield Unit
        const normalizeYieldUnit = (u: string): 'pages' | 'copies' | 'unknown' => {
            const lower = u.toLowerCase();
            if (lower.includes('page') || lower.includes('стр') || lower === 'p') return 'pages';
            if (lower.includes('cop') || lower.includes('коп')) return 'copies';
            return 'unknown'; // strictly unknown if not pages/copies
        };

        const parsed: FiresearchParsed = {
            brand: initialParse.brand.brand || 'Unknown',
            consumable_type: initialParse.detectedType.value,
            model_oem: initialParse.model.model || '',
            model_short: modelShort,
            printer_models_from_title: [],
            yield: {
                value: initialParse.yieldInfo[0]?.value || 'unknown',
                unit: normalizeYieldUnit(initialParse.yieldInfo[0]?.unit || '')
            },
            color: (initialParse.detectedColor.value as any) || 'unknown',
            notes: []
        };

        let currentData: StrictConsumableData = {
            supplier_title_raw: query,
            title_norm: query,
            automation_status: 'needs_review',
            publish_ready: false,
            mpn_identity: { mpn: parsed.model_oem, canonical_model_name: parsed.model_oem, variant_flags: { chip: false, counterless: false, high_yield: false, kit: false } },
            brand: parsed.brand,
            consumable_type: parsed.consumable_type as any,
            model: parsed.model_oem,
            short_model: null,
            model_alias_short: null,
            yield: null,
            color: parsed.color,
            has_chip: 'unknown',
            has_page_counter: 'unknown',
            printers_ru: [],
            compatible_printers_ru: [],
            compatible_printers_unverified: [],
            packaging_from_nix: null,
            images: [],
            sources: [],

            parsed: parsed,
            packaging: undefined,
            compatibility_ru: undefined,
            related_consumables: undefined,
            image_candidates: [],
            faq: [],
            meta: {
                run_mode: mode,
                budgets: {
                    time_ms: config.maxRuntimeMs,
                    calls: config.maxTotalSearchCalls,
                    sources: config.maxTotalSourcesCollected
                },
                stats: stats,
                warnings: []
            }
        };

        let iteration = 0;
        const missingFields = this.identifyMissingFields(currentData, effectiveStrict);
        let noProgressCount = 0;

        while (true) {
            const runtime = Date.now() - startTime;
            if (runtime > config.maxRuntimeMs) {
                logs.push(`[DeepResearch] STOP: Max runtime exceeded`);
                currentData.meta!.warnings.push('Max runtime exceeded');
                break;
            }
            if (stats.calls_made >= config.maxTotalSearchCalls) {
                logs.push(`[DeepResearch] STOP: Max calls exceeded`);
                currentData.meta!.warnings.push('Max search calls exceeded');
                break;
            }

            iteration++;
            stats.iterations = iteration;
            logs.push(`[DeepResearch] --- Iteration ${iteration} ---`);

            const plan = this.planner(query, currentData, config, missingFields);
            if (this.isPlanEmpty(plan)) {
                logs.push(`[DeepResearch] Plan empty. Nothing more to do.`);
                break;
            }

            const { findings, calls, sources } = await this.collector(plan, config, logs, stats);
            stats.calls_made += calls;
            stats.sources_collected += sources;

            if (findings.length === 0) {
                noProgressCount++;
                logs.push(`[DeepResearch] No new sources found (Streak: ${noProgressCount})`);
                if (noProgressCount >= 2) break;
            } else {
                noProgressCount = 0;
            }

            if (findings.length > 0) {
                const extractionResult = await this.extractor(findings, currentData, plan, logs, strictSources);

                let progressed = false;

                if (extractionResult.packaging && !currentData.packaging) {
                    currentData.packaging = extractionResult.packaging;
                    missingFields.delete('logistics');
                    progressed = true;
                }

                if (extractionResult.compatibility_ru) {
                    if (!currentData.compatibility_ru || (currentData.compatibility_ru.needs_review && !extractionResult.compatibility_ru.needs_review)) {
                        currentData.compatibility_ru = extractionResult.compatibility_ru;
                        missingFields.delete('compatibility');
                        progressed = true;
                    }
                }

                if (extractionResult.related_consumables) {
                    currentData.related_consumables = extractionResult.related_consumables;
                    missingFields.delete('related');
                    progressed = true;
                }

                if (extractionResult.image_candidates && extractionResult.image_candidates.length > 0) {
                    currentData.image_candidates = [...(currentData.image_candidates || []), ...extractionResult.image_candidates];
                    missingFields.delete('images');
                    progressed = true;
                }

                if (extractionResult.faq && extractionResult.faq.length > 0) {
                    if (!currentData.faq || currentData.faq.length === 0) {
                        currentData.faq = extractionResult.faq;
                        missingFields.delete('faq');
                        progressed = true;
                    }
                }
                logs.push(`[DeepResearch] Merge complete. Progressed: ${progressed}`);
            }

            if (this.isValidationSatisfied(currentData)) {
                logs.push(`[DeepResearch] Validation Satisfied!`);
                currentData.automation_status = 'done';
                break;
            }
        }

        stats.duration_ms = Date.now() - startTime;
        currentData.meta!.stats = stats;

        // Final Status Calculation
        if (currentData.automation_status !== 'done') {
            if (currentData.packaging?.not_found_on_nix) {
                currentData.meta!.warnings.push('NIX_NOT_FOUND');
            }
            if (currentData.compatibility_ru?.needs_review) {
                if (currentData.compatibility_ru.exclusion_notes?.some(n => n.includes('Consensus'))) {
                    currentData.meta!.warnings.push('CONSENSUS_FAILED');
                } else {
                    currentData.meta!.warnings.push('COMPATIBILITY_UNCERTAIN');
                }
            }
            if (!currentData.images || currentData.images.length === 0) {
                currentData.meta!.warnings.push('NO_IMAGES_FOUND');
            }

            if (currentData.packaging?.not_found_on_nix || currentData.compatibility_ru?.needs_review || currentData.related_consumables?.needs_review) {
                currentData.automation_status = 'needs_review';
            } else {
                currentData.automation_status = 'needs_review';
            }
        }

        return {
            data: currentData,
            logs,
            status: currentData.automation_status
        };
    }

    private isPlanEmpty(plan: ResearchPlan) {
        return plan.nix_queries.length === 0 &&
            plan.compatibility_queries.length === 0 &&
            plan.related_queries.length === 0 &&
            plan.image_queries.length === 0 &&
            plan.faq_queries.length === 0;
    }

    private planner(query: string, data: StrictConsumableData, config: SearchConfig, missing: Set<string>): ResearchPlan {
        const plan: ResearchPlan = {
            nix_queries: [],
            compatibility_queries: [],
            related_queries: [],
            image_queries: [],
            faq_queries: [],
            logistics_needed: missing.has('logistics'),
            compatibility_needed: missing.has('compatibility'),
            related_needed: missing.has('related'),
            images_needed: missing.has('images'),
            faq_needed: missing.has('faq'),
            compatibility_tier_needed: data.compatibility_ru?.needs_review && missing.has('compatibility') ? 'oem_or_more_retailers' : 'none'
        };

        const coreId = `${data.brand || ''} ${data.model || query}`.trim();

        if (plan.logistics_needed && !data.packaging?.not_found_on_nix && !data.packaging) {
            plan.nix_queries.push(`site:nix.ru ${coreId} вес размеры упаковки`);
            if (data.model) plan.nix_queries.push(`site:nix.ru "${data.model}" характеристики`);
            if (config.searchLimitPerStep < 3) plan.nix_queries = plan.nix_queries.slice(0, 2);
        }

        if (plan.compatibility_needed || plan.compatibility_tier_needed !== 'none') {
            if (data.brand) {
                plan.compatibility_queries.push(`site:${data.brand.toLowerCase()}.com ${data.model} compatibility`);
                plan.compatibility_queries.push(`site:${data.brand.toLowerCase()}.ru ${data.model} совместимость`);
            }
            plan.compatibility_queries.push(`site:cartridge.ru ${coreId} совместимость`);
            plan.compatibility_queries.push(`site:rashodnika.net ${coreId} принтеры`);
            plan.compatibility_queries.push(`${coreId} список совместимых принтеров`);

            if (config.searchLimitPerStep < 5) plan.compatibility_queries = plan.compatibility_queries.slice(0, 4);
        }

        if (plan.related_needed) {
            plan.related_queries.push(`${coreId} similar products`);
            plan.related_queries.push(`${coreId} аналог купить`);
        }

        if (plan.images_needed) {
            plan.image_queries.push(`${coreId} imagesize:800x800`);
            plan.image_queries.push(`${coreId} larger:800x800`);
            plan.image_queries.push(`${coreId} product photo`);
        }

        if (plan.faq_needed) {
            plan.faq_queries.push(`${coreId} problems troubleshooting`);
            plan.faq_queries.push(`${coreId} installation guide`);
        }

        return plan;
    }

    private async collector(plan: ResearchPlan, config: SearchConfig, logs: string[], stats: { iterations: number }): Promise<{ findings: { type: string, urls: string[] }[], calls: number, sources: number }> {
        const findings: { type: string, urls: string[] }[] = [];
        let calls = 0;
        let sourcesCount = 0;

        const executeBatch = async (queries: string[], type: string, searchOptions: SearchOptions = {}) => {
            const urls = new Set<string>();
            // Adaptive Limit: Increase limit by 1 for each iteration after the first
            const adaptiveLimit = config.searchLimitPerStep + Math.max(0, stats.iterations - 1);

            for (const q of queries) {
                if (calls >= adaptiveLimit) break;

                try {
                    logs.push(`[DeepResearch] Searching (${type}): ${q} (Limit: ${adaptiveLimit})`);
                    const res = await firecrawlSearch(q, {
                        limit: 3,
                        scrapeOptions: { formats: ['markdown'] },
                        ...searchOptions
                    });
                    calls++;

                    if (!res.success) {
                        if (res.statusCode === 402 || res.statusCode === 401) {
                            const msg = `CRITICAL: Firecrawl API Error ${res.statusCode} (Payment/Auth). Stopping workflow.`;
                            logs.push(msg);
                            throw new Error(msg); // Throwing here catches below, we need to propagate up or break completely
                        }
                        if (res.statusCode === 429) {
                            logs.push(`[DeepResearch] Rate limit hit. Waiting 5s...`);
                            await new Promise(r => setTimeout(r, 5000));
                        }
                        logs.push(`[DeepResearch] Search failed for ${q}: ${res.error}`);
                        continue;
                    }

                    if (res.data && Array.isArray(res.data)) {
                        logs.push(`[DeepResearch] Found ${res.data.length} items for ${q}`);
                        res.data.forEach((item: any) => {
                            if (item.url) urls.add(item.url);
                        });
                    }
                } catch (e) {
                    const err = e as Error;
                    logs.push(`[DeepResearch] Error in ${type}: ${err.message}`);
                    if (err.message.includes('CRITICAL') || err.message.includes('402')) {
                        throw err; // Re-throw critical errors to stop the entire service
                    }
                }
            }
            if (urls.size > 0) {
                findings.push({ type, urls: Array.from(urls) });
                sourcesCount += urls.size;
            }
        };

        try {
            if (plan.nix_queries.length > 0) await executeBatch(plan.nix_queries, 'logistics', { location: 'ru' });
            if (plan.compatibility_queries.length > 0) await executeBatch(plan.compatibility_queries, 'compatibility', { location: 'ru' });
            if (plan.related_queries.length > 0) await executeBatch(plan.related_queries, 'related', { location: 'ru' });
            if (plan.faq_queries.length > 0) await executeBatch(plan.faq_queries, 'faq', { location: 'ru' });
            if (plan.image_queries.length > 0) await executeBatch(plan.image_queries, 'images', { is_image: true, sources: ['images'] });
        } catch (e) {
            // Propagate critical errors up to executeWorkflow to stop the loop
            const err = e as Error;
            if (err.message.includes('CRITICAL')) throw err;
        }

        return { findings, calls, sources: sourcesCount };
    }

    /**
     * Helper: Validate URL against whitelist / Tiers
     */
    private isWhitelisted(url: string, category: 'logistics' | 'compatibility'): boolean {
        const domain = new URL(url).hostname.replace('www.', '');
        // For compatibility, we check Tier B explicitly here, or the combined list
        // logic moved to checkSourceTier
        if (category === 'logistics') {
            return APP_CONFIG.sources.logistics.some(w => domain.endsWith(w));
        }
        return false;
    }

    private isOEM(url: string, brand: string): boolean {
        if (!brand) return false;
        return url.toLowerCase().includes(brand.toLowerCase());
    }

    private checkSourceTier(url: string, brand: string): 'TierA' | 'TierB' | 'TierC' | 'Unknown' {
        const domain = new URL(url).hostname.toLowerCase().replace('www.', '');

        // Tier A: OEM
        // Check exact brand match first
        if (brand && (domain.includes(brand.toLowerCase()) ||
            APP_CONFIG.sources.tierA_oem.some(o => domain.endsWith(o) && o.includes(brand.toLowerCase())))) {
            return 'TierA';
        }
        // General OEM check
        if (APP_CONFIG.sources.tierA_oem.some(o => domain.endsWith(o))) return 'TierA';

        // Tier B: Retailers
        if (APP_CONFIG.sources.tierB_retailer.some(r => domain.endsWith(r))) return 'TierB';

        // Tier C: Marketplaces/Forums (Approximation)
        if (domain.includes('ozon') || domain.includes('wildberries') || domain.includes('yandex') || domain.includes('forum') || domain.includes('otvet')) return 'TierC';

        return 'Unknown';
    }

    private async extractor(findings: { type: string, urls: string[] }[], currentData: StrictConsumableData, plan: ResearchPlan, logs: string[], strictSources: boolean): Promise<Partial<StrictConsumableData>> {
        const logisticsUrls = findings.find(f => f.type === 'logistics')?.urls || [];
        const compatUrls = findings.find(f => f.type === 'compatibility')?.urls || [];
        const relatedUrls = findings.find(f => f.type === 'related')?.urls || [];
        const faqUrls = findings.find(f => f.type === 'faq')?.urls || [];
        const imageUrls = findings.find(f => f.type === 'images')?.urls || [];

        const result: Partial<StrictConsumableData> = {};

        // 1. Logistics Extraction (Strict NIX)
        // Filter urls to only NIX
        const nixUrls = logisticsUrls.filter(u => this.isWhitelisted(u, 'logistics'));
        if (nixUrls.length > 0 && !currentData.packaging) {
            logs.push(`[DeepResearch] Extracting logistics from ${nixUrls.length} NIX urls`);
            const prompt = `Extract strict packaging dimensions (mm) and weight (g) from NIX.ru. If not NIX.ru, ignore logistics.`;
            const validationSchema = {
                type: 'object',
                properties: {
                    package_mm: { type: 'object', properties: { length: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } } },
                    package_weight_g: { type: 'number' },
                    found_on_nix: { type: 'boolean' }
                }
            };

            const extracted = await extractData(nixUrls.slice(0, 3), prompt, validationSchema);
            if (extracted && (extracted.found_on_nix || extracted.package_weight_g)) {
                result.packaging = {
                    package_mm: extracted.package_mm || { length: 0, width: 0, height: 0 },
                    package_weight_g: extracted.package_weight_g || 0,
                    evidence_urls: nixUrls.slice(0, 3),
                    not_found_on_nix: false
                };
            }
        } else if (plan.logistics_needed && logisticsUrls.length > 0 && nixUrls.length === 0) {
            // We searched for nix logic but found non-nix urls? Or maybe no results?
            // Only set not_found if we specifically tried nix queries and got no nix urls
        }

        // 2. Compatibility Extraction
        // Filter urls: Whitelist OR OEM
        let validCompatUrls = compatUrls;
        if (strictSources) {
            validCompatUrls = compatUrls.filter(u => this.isWhitelisted(u, 'compatibility') || this.isOEM(u, currentData.brand));
        } else {
            // Non-strict: allow all compatibility urls if we confirm they are relevant
            // But let's keep some quality control - maybe just trust whatever firecrawl found?
            // For now, let's just stick to the prompt requirement: "if strict_sources=true, ONLY whitelist". 
            // If false, we use all `compatUrls`.
            validCompatUrls = compatUrls;
        }

        if (validCompatUrls.length > 0) {
            // Logic: we want to extract from enough sources to reach consensus.
            // If strictly enforcing, we focus on Tier A/B.
            // If we have existing data but it needs review, we merge new info.

            logs.push(`[DeepResearch] Extracting compatibility from ${validCompatUrls.length} urls`);
            const prompt = `List all compatible PRINTER models. Return rigorous list.`;
            const schema = {
                type: 'object',
                properties: {
                    printers: { type: 'array', items: { type: 'string' } }
                }
            };

            const extracted = await extractData(validCompatUrls.slice(0, 5), prompt, schema);

            if (extracted && extracted.printers && extracted.printers.length > 0) {
                // Consensus Logic
                const tiers = validCompatUrls.map(u => this.checkSourceTier(u, currentData.brand || ''));
                const tierACount = tiers.filter(t => t === 'TierA').length;
                const tierBCount = tiers.filter(t => t === 'TierB').length;

                // Count unique domains for Tier B
                const uniqueTierBDomains = new Set(
                    validCompatUrls
                        .filter((u, i) => tiers[i] === 'TierB')
                        .map(u => new URL(u).hostname)
                ).size;

                const isTrusted = tierACount >= 1 || uniqueTierBDomains >= 2;

                // Merge logic: If we already have printers, we define a strategy. 
                // For now, simpler: overwrite or unique merge. Let's precise unique merge.
                const existing = currentData.compatibility_ru?.printers || [];
                const mergedPrinters = Array.from(new Set([...existing, ...extracted.printers]));

                result.compatibility_ru = {
                    printers: mergedPrinters,
                    evidence_urls: [...(currentData.compatibility_ru?.evidence_urls || []), ...validCompatUrls.slice(0, 5)],
                    needs_review: !isTrusted,
                    exclusion_notes: !isTrusted ? [`Consensus check failed: TierA=${tierACount}, UniqueTierB=${uniqueTierBDomains}`] : []
                };
            }
        }

        // 3. Related Consumables
        if (relatedUrls.length > 0 && !currentData.related_consumables) {
            logs.push(`[DeepResearch] Extracting related consumables`);
            const prompt = `List similar consumable models (e.g. for same printer series).`;
            const schema = {
                type: 'object',
                properties: {
                    related: { type: 'array', items: { type: 'string' } }
                }
            };
            const extracted = await extractData(relatedUrls.slice(0, 3), prompt, schema);
            if (extracted && extracted.related) {
                result.related_consumables = {
                    for_similar_products_block: extracted.related,
                    evidence_urls: relatedUrls.slice(0, 3),
                    needs_review: extracted.related.length < 5
                };
            }
        }

        // 4. FAQ Extraction
        if (faqUrls.length > 0) {
            logs.push(`[DeepResearch] Extracting FAQ`);
            const prompt = `Generate 3-5 FAQ items (Q&A) about this consumable. Focus on installation, chips, errors.`;
            const schema = {
                type: 'object',
                properties: {
                    faqs: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { q: { type: 'string' }, a: { type: 'string' } }
                        }
                    }
                }
            };
            const extracted = await extractData(faqUrls.slice(0, 3), prompt, schema);
            if (extracted && extracted.faqs) {
                result.faq = extracted.faqs.map((f: any) => ({
                    q: f.q,
                    a: f.a,
                    evidence_urls: faqUrls.slice(0, 1)
                }));
            }
        }

        // 5. Images
        if (imageUrls.length > 0) {
            logs.push(`[DeepResearch] Found ${imageUrls.length} image candidates`);
            result.image_candidates = imageUrls.map(url => ({
                url,
                no_watermark_likely: true,
                no_trademark_likely: true,
                notes: 'Firecrawl Image Search'
            }));
        }

        return result;
    }

    private isValidationSatisfied(data: StrictConsumableData): boolean {
        const hasLogistics = !!data.packaging;
        const hasCompat = !!data.compatibility_ru && data.compatibility_ru.printers.length > 0;
        const hasFaq = !!data.faq && data.faq.length > 0;
        const hasRelated = !!data.related_consumables;
        return hasLogistics && hasCompat && hasFaq && hasRelated;
    }
    private identifyMissingFields(data: StrictConsumableData, strict: boolean): Set<string> {
        const missing = new Set<string>();

        // Logistics is core
        if (!data.packaging_from_nix && !data.packaging?.not_found_on_nix) missing.add('logistics');

        // Compatibility is core - keep looking if it needs review
        if (!data.compatible_printers_ru || data.compatible_printers_ru.length === 0 || (data.compatibility_ru?.needs_review && strict)) missing.add('compatibility');

        // Related is core for network effect
        if (!data.related_consumables || !data.related_consumables.for_similar_products_block || data.related_consumables.for_similar_products_block.length === 0) {
            missing.add('related');
        }

        // Images are core
        if (!data.images || data.images.length === 0) missing.add('images');

        // FAQ is core
        if (!data.faq || data.faq.length === 0) missing.add('faq');

        return missing;
    }
}

export const deepResearchService = DeepResearchService.getInstance();
