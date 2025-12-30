import { StrictConsumableData, AutomationStatus, FiresearchMeta } from '../types/domain';
import { plannerAgent } from './agents/planner';
import { retrieverAgent } from './agents/retriever';
import { extractorAgent } from './agents/extractor';
import { verifierAgent } from './agents/verifier';
import { AppMode, APP_CONFIG, getModeConfig } from './config';

export interface DeepResearchResult {
    data: StrictConsumableData;
    logs: string[];
    status: AutomationStatus;
}

/**
 * Deep Research Service (Agentic Implementation)
 * Orchestrates: Planner -> Retriever -> Extractor -> Verifier
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

    public async executeWorkflow(
        query: string,
        mode: AppMode = 'standard',
        locale: string = 'RU',
        strictSources: boolean = true,
        onUpdate?: (msg: string) => void
    ): Promise<DeepResearchResult> {
        const logs: string[] = [];
        const log = (msg: string) => {
            logs.push(msg);
            if (onUpdate) onUpdate(msg);
        };

        const config = getModeConfig(mode);
        log(`[Agent] Starting Research (Mode: ${mode.toUpperCase()}) for: "${query}"`);

        // Initialize Data
        const currentData: StrictConsumableData = this.createEmptyData(query, mode);

        // 1. PLAN
        log(`[Agent] Planning...`);
        const plan = await plannerAgent.plan(query);
        log(`[Agent] Intent: ${plan.intent}`);

        // Update initial identity from Plan Entitites
        const brand = plan.entities.find(e => e.type === 'brand')?.value;
        const model = plan.entities.find(e => e.type === 'model')?.value;
        if (brand) currentData.brand = brand;
        if (model) currentData.model = model;

        // 2. EXECUTE LOOP
        let searchPasses = 0;
        const maxPasses = mode === 'exhaustive' ? 3 : 1;

        while (searchPasses < maxPasses) {
            searchPasses++;
            log(searchPasses > 1 ? `[Agent] Deep Mode: Starting search pass ${searchPasses}...` : `[Agent] Executing Plan...`);

            for (const step of plan.steps) {
                if (step.type === 'search') {
                    // RETRIEVE
                    const findings = await retrieverAgent.execute(step);
                    log(`[Agent] Pass ${searchPasses}: Found ${findings.length} sources for "${step.description}"`);

                    if (findings.length === 0) continue;

                    // EXTRACT
                    log(`[Agent] Extracting data...`);
                    const extractionSchema = {
                        type: 'OBJECT',
                        properties: {
                            packaging_mm: { type: 'OBJECT', properties: { length: { type: 'NUMBER' }, width: { type: 'NUMBER' }, height: { type: 'NUMBER' } } },
                            weight_g: { type: 'NUMBER' },
                            compatible_printers: { type: 'ARRAY', items: { type: 'STRING' } },
                            yield_pages: { type: 'NUMBER' },
                            images: { type: 'ARRAY', items: { type: 'STRING' } }
                        }
                    };

                    const extResults = await extractorAgent.batchExtract<any>(findings, extractionSchema, `Context: ${query} ${brand} ${model}`);

                    // MERGE with Strategy
                    for (const res of extResults) {
                        this.mergeData(currentData, res.data, res.source.sourceUrl, strictSources, config.conflictResolutionStrategy);
                    }
                }
            }

            if (currentData.packaging && currentData.compatibility_ru?.printers.length) {
                log(`[Agent] Sufficient data collected. Stopping early.`);
                break;
            }
        }

        // 3. VERIFY
        log(`[Agent] Verifying data...`);
        const verification = verifierAgent.verify(currentData);

        // Deep Mode: Strict NIX enforcement
        if (config.requireNixForLogistics && currentData.packaging && !currentData.packaging.not_found_on_nix) {
            const hasNix = currentData.packaging.evidence_urls.some(u => u.includes('nix.ru'));
            if (!hasNix) {
                verification.isValid = false;
                verification.issues.push("Missing mandatory NIX.ru source for logistics (Balanced/Deep requirement).");
            }
        }

        if (!verification.isValid) {
            currentData.automation_status = 'needs_review';
            if (currentData.meta && currentData.meta.warnings) {
                currentData.meta.warnings.push(...verification.issues);
            }
            log(`[Agent] Verification flagged issues: ${verification.issues.join(', ')}`);
        } else {
            currentData.automation_status = 'done';
            currentData.publish_ready = true;
            log(`[Agent] Verification passed.`);
        }

        return {
            data: currentData,
            logs,
            status: currentData.automation_status
        };
    }

    private mergeData(
        target: StrictConsumableData,
        source: any,
        url: string,
        strict: boolean,
        conflictStrategy: 'first_win' | 'consensus' | 'ask_user' = 'first_win'
    ) {
        // Logistics
        if (source.packaging_mm && source.weight_g) {
            if (!target.packaging) {
                target.packaging = {
                    package_mm: source.packaging_mm,
                    package_weight_g: source.weight_g,
                    evidence_urls: [url],
                    not_found_on_nix: false
                } as any; // Using any to bypass explicit type check for now if interface mismatch slightly
            } else {
                // Conflict Resolution Logic
                if (target.packaging) {
                    const diff = Math.abs((target.packaging.package_weight_g || 0) - source.weight_g);
                    if (diff > 50) { // Significant difference > 50g
                        // If strategy is 'ask_user', record conflict
                        if (conflictStrategy === 'ask_user') {
                            if (!target.meta) target.meta = { run_mode: 'exhaustive' } as any;
                            if (!target.meta!.conflicts) target.meta!.conflicts = [];

                            target.meta!.conflicts!.push({
                                field: 'weight_g',
                                valueA: target.packaging.package_weight_g,
                                valueB: source.weight_g,
                                sourceA: target.packaging.evidence_urls[0] || 'existing',
                                sourceB: url,
                                strategy_used: conflictStrategy,
                                resolution: 'unresolved'
                            });

                            // Flag for review
                            target.automation_status = 'needs_review';
                        } else if (conflictStrategy === 'consensus') {
                            // Simple Consensus: If new source is from Tier A and old is Tier B, replace?
                            // For now, keep 'first_win' behavior but maybe log warning.
                            // Implementing full voting consensus is complex without multiple candidates storage.
                            // MVP: Stick to First Win but log warning.
                        }
                    }
                }

                if (!target.packaging?.evidence_urls.includes(url)) {
                    target.packaging?.evidence_urls.push(url);
                }
            }
        }

        // Compatibility
        if (source.compatible_printers && source.compatible_printers.length > 0) {
            const existing = new Set(target.compatibility_ru?.printers || []);
            source.compatible_printers.forEach((p: string) => existing.add(p));

            const existingUrls = target.compatibility_ru?.evidence_urls || [];
            if (!existingUrls.includes(url)) existingUrls.push(url);

            target.compatibility_ru = {
                printers: Array.from(existing),
                evidence_urls: existingUrls,
                needs_review: (target.meta?.conflicts?.length || 0) > 0, // Keep needs_review if conflicts exist
                exclusion_notes: []
            };
        }

        // Images
        if (source.images && source.images.length > 0) {
            // merge images logic placeholder
        }
    }

    private createEmptyData(query: string, mode: AppMode): StrictConsumableData {
        return {
            supplier_title_raw: query,
            title_norm: query,
            automation_status: 'needs_review',
            publish_ready: false,
            mpn_identity: { mpn: '', canonical_model_name: '', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false } },
            brand: null,
            consumable_type: 'unknown',
            model: null,
            short_model: null,
            model_alias_short: null,
            yield: null,
            color: null,
            has_chip: 'unknown',
            has_page_counter: 'unknown',
            printers_ru: [],
            compatible_printers_ru: [],
            compatible_printers_unverified: [],
            packaging_from_nix: null,
            images: [],
            sources: [],
            meta: {
                run_mode: mode,
                budgets: { time_ms: 0, calls: 0, sources: 0 },
                stats: { iterations: 0, sources_collected: 0, calls_made: 0, duration_ms: 0 },
                warnings: []
            }
        };
    }
}

export const deepResearchService = DeepResearchService.getInstance();
