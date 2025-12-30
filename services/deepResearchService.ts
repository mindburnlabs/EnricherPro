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
            faq_needed: missing.has('faq')
        };

        const coreId = `${data.brand || ''} ${data.model || query}`.trim();

        if (plan.logistics_needed && !data.packaging?.not_found_on_nix && !data.packaging) {
            plan.nix_queries.push(`site:nix.ru ${coreId} вес размеры упаковки`);
            plan.nix_queries.push(`site:nix.ru ${coreId} характеристика`);
            if (config.searchLimitPerStep < 3) plan.nix_queries = plan.nix_queries.slice(0, 1);
        }

        if (plan.compatibility_needed) {
            if (data.brand) {
                plan.compatibility_queries.push(`site:${data.brand.toLowerCase()}.com ${data.model} compatibility`);
                //  plan.compatibility_queries.push(`site:${data.brand.toLowerCase()}.ru ${data.model} совместимость`);
            }
            plan.compatibility_queries.push(`site:cartridge.ru ${coreId} совместимость`);
            plan.compatibility_queries.push(`site:rashodnika.net ${coreId} принтеры`);
            // Fallback
            plan.compatibility_queries.push(`${coreId} совместимые принтеры купить`);

            if (config.searchLimitPerStep < 5) plan.compatibility_queries = plan.compatibility_queries.slice(0, 3);
        }

        if (plan.related_needed) {
            plan.related_queries.push(`${coreId} similar products`);
            plan.related_queries.push(`${coreId} compatible series cartridges`);
        }

        if (plan.images_needed) {
            plan.image_queries.push(`${coreId} product photo white background -box`);
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

                    if (res.data) {
                        const items = Array.isArray(res.data) ? res.data : (res.data.data || []);
                        logs.push(`[DeepResearch] Found ${items.length} items for ${q}`);
                        items.forEach((item: any) => {
                            if (item.url) urls.add(item.url);
                        });
                    }
                } catch (e) {
                    logs.push(`[DeepResearch] Error in ${type}: ${(e as Error).message}`);
                }
            }
            if (urls.size > 0) {
                findings.push({ type, urls: Array.from(urls) });
                sourcesCount += urls.size;
            }
        };

        if (plan.nix_queries.length > 0) await executeBatch(plan.nix_queries, 'logistics', { location: 'ru' });
        if (plan.compatibility_queries.length > 0) await executeBatch(plan.compatibility_queries, 'compatibility', { location: 'ru' });
        if (plan.related_queries.length > 0) await executeBatch(plan.related_queries, 'related', { location: 'ru' });
        if (plan.faq_queries.length > 0) await executeBatch(plan.faq_queries, 'faq', { location: 'ru' });
        if (plan.image_queries.length > 0) await executeBatch(plan.image_queries, 'images', { is_image: true, sources: ['images'] });

        return { findings, calls, sources: sourcesCount };
    }

    /**
     * Helper: Validate URL against whitelist
     */
    private isWhitelisted(url: string, category: 'logistics' | 'compatibility'): boolean {
        const domain = new URL(url).hostname.replace('www.', '');
        const whitelist = APP_CONFIG.sources[category];
        return whitelist.some(w => domain.endsWith(w));
    }

    private isOEM(url: string, brand: string): boolean {
        if (!brand) return false;
        return url.toLowerCase().includes(brand.toLowerCase());
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

        if (validCompatUrls.length > 0 && !currentData.compatibility_ru) {
            logs.push(`[DeepResearch] Extracting compatibility from ${validCompatUrls.length} valid urls (Strict: ${strictSources})`);
            const prompt = `List all compatible PRINTER models.`;
            const schema = {
                type: 'object',
                properties: {
                    printers: { type: 'array', items: { type: 'string' } },
                    is_ru_source: { type: 'boolean' }
                }
            };
            // Increase limit if not strict?
            const extracted = await extractData(validCompatUrls.slice(0, 5), prompt, schema);
            if (extracted && extracted.printers && extracted.printers.length > 0) {
                // Check Trust Rules: 
                const oemCount = validCompatUrls.filter(u => this.isOEM(u, currentData.brand)).length;
                const whitelistCount = validCompatUrls.filter(u => this.isWhitelisted(u, 'compatibility')).length;

                // If strict, we enforce 2 whitelist or 1 OEM.
                // If NOT strict, do we enforce trust? 
                // The prompt says "Trust rules: ...". It doesn't say these rules are optional in non-strict mode.
                // But "strict_sources" parameter implies the SOURCE selection is strict.
                // Let's assume trust rules apply to the *result* classification (needs_review).

                const isTrusted = oemCount >= 1 || whitelistCount >= 2;

                result.compatibility_ru = {
                    printers: extracted.printers,
                    evidence_urls: validCompatUrls.slice(0, 5),
                    needs_review: !isTrusted,
                    exclusion_notes: !isTrusted ? ['Insufficient independent sources (Strict/Trust Rule)'] : []
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
        if (!data.packaging_from_nix) missing.add('logistics');

        // Compatibility is core
        if (!data.compatible_printers_ru || data.compatible_printers_ru.length === 0) missing.add('compatibility');

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
