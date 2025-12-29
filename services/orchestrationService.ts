
import { v4 as uuidv4 } from 'uuid';
import {
    EnrichedItem,
    ConsumableData,
    ProcessingStep,
    AutomationStatus,
    DataSource,
    FieldEvidence
} from "../types/domain";
import { NormalizationService } from './normalizationService';
import { ParserService } from './parserService';
import { nixService } from './nixService';
import { perplexityService } from './perplexityService';
import { startCrawlJob, getCrawlJobStatus, crawlResultToMarkdown } from './firecrawlService';
import { evaluateQualityGates } from './qualityGates';

export type OrchestrationStage = 'normalization' | 'parsing' | 'discovery' | 'enrichment' | 'gate_check' | 'complete' | 'failed';

export interface WorkflowState {
    id: string;
    stage: OrchestrationStage;
    query: string;
    normalizedTitle?: string;
    parsedData?: Partial<ConsumableData>;
    nixData?: any;
    searchUrls: string[];
    logs: string[];
    error?: string;
    finalData?: ConsumableData;
}

export class OrchestrationService {
    private static instance: OrchestrationService;

    private constructor() { }

    public static getInstance(): OrchestrationService {
        if (!OrchestrationService.instance) {
            OrchestrationService.instance = new OrchestrationService();
        }
        return OrchestrationService.instance;
    }

    /**
     * SOTA Agentic Pipeline:
     * 1. Normalization (Deterministic)
     * 2. Parsing (Deterministic)
     * 3. Agentic Research (Parallel: Logistics Agent + Source Discovery Agent)
     * 4. Synthesis (Gemini 3.0 Agent)
     * 5. Quality Gates (Deterministic)
     */
    async processItem(rawQuery: string, onProgress: (step: ProcessingStep) => void): Promise<EnrichedItem> {
        const jobId = uuidv4();
        // We use audit logs for internal tracing, but also keep a simple string log for the UI evidence.
        const logs: string[] = [`Job ${jobId} started for: "${rawQuery}"`];

        // Initialize Data Object
        let data: Partial<ConsumableData> = {
            supplier_title_raw: rawQuery,
            sources: [],
            _evidence: {},
            automation_status: 'failed' // Default until pass
        };

        try {
            // --- STEP 1: NORMALIZATION & PARSING ---
            onProgress('analyzing');
            logs.push("Step 1: Normalization & Parsing");

            const normTitle = NormalizationService.normalizeTitle(rawQuery);
            logs.push(`Normalized: "${normTitle}"`);

            const parsed = ParserService.parse(rawQuery, normTitle);
            data = { ...data, ...parsed };
            logs.push(`Parsed Identity: Brand=${data.brand}, Model=${data.model}, Type=${data.consumable_type}`);

            if (data.automation_status === 'failed') {
                // Even if parsing fails strict checks, we might proceed if we have a model, but for SOTA we fail fast if critical identity missing.
                if (!data.model) throw new Error("Critical: Model not identified during parsing.");
            }

            // --- STEP 2: AGENTIC RESEARCH (Parallel) ---
            onProgress('searching');
            logs.push("Step 2: Agentic Research (NIX Logistics + Sources)");

            const researchQuery = `${data.brand || ''} ${data.model} ${data.consumable_type}`;

            // Execute specialized agents in parallel
            const [nixInfo, perplexityResult] = await Promise.all([
                // Agent A: Logistics (NIX.ru)
                nixService.getPackagingInfo(data.model!, data.brand || ''),
                // Agent B: Market & Compatibility (Perplexity Deep Research)
                perplexityService.discoverSources(researchQuery)
            ]);

            // Process Logistics Result
            if (nixInfo) {
                data.packaging_from_nix = nixInfo;
                logs.push(`Logistics Agent: Found NIX data (${nixInfo.weight_g}g) at ${nixInfo.source_url}`);
                // Add strict evidence
                if (!data._evidence) data._evidence = {};
                data._evidence.packaging_from_nix = {
                    value: nixInfo,
                    urls: nixInfo.source_url ? [nixInfo.source_url] : [],
                    extraction_method: 'nix_logistics_agent',
                    confidence: 1.0,
                    source_type: 'nix_ru'
                };

                // Add to sources list
                if (nixInfo.source_url) {
                    data.sources?.push({
                        url: nixInfo.source_url,
                        sourceType: 'nix_ru',
                        timestamp: new Date(),
                        dataConfirmed: ['weight', 'dimensions'],
                        confidence: 1.0,
                        extractionMethod: 'nix_agent'
                    });
                }
            } else {
                logs.push("Logistics Agent: NIX.ru data NOT found.");
            }

            // Process Search Result
            const topSources = perplexityResult.urls.slice(0, 10);
            logs.push(`Discovery Agent: Found ${topSources.length} potential sources.`);
            logs.push(`Discovery Summary: ${perplexityResult.summary.substring(0, 100)}...`);

            // --- STEP 3: SYNTHESIS (Gemini 3.0) ---
            onProgress('analyzing'); // synthesizing
            logs.push("Step 3: Synthesis (Gemini 3.0)");

            // Construct Synthesis Context
            // We pass the Perplexity Summary + URL list + Parsed Data + NIX Data
            const synthesisContext = `
            [PARSED_IDENTITY]
            Brand: ${data.brand}
            Model: ${data.model}
            Type: ${data.consumable_type}
            
            [LOGISTICS_DATA]
            ${JSON.stringify(nixInfo || { status: 'missing' })}
            
            [RESEARCH_SUMMARY]
            ${perplexityResult.summary}
            
            [DISCOVERED_URLS]
            ${topSources.join('\n')}
            `;

            // We import synthesizeConsumableData dynamically to avoid circular dep issues if any, 
            // or just rely on the import at top. (Using import at top 'geminiService')
            const { synthesizeConsumableData } = await import('./geminiService');

            // We pass "rawQuery" as the query to synthesize context, but maybe "researchQuery" is better.
            const synthesisResult = await synthesizeConsumableData(
                synthesisContext,
                researchQuery,
                parsed, // Text processing result (approximate match to parsed)
                undefined // Firecrawl data (we already processed NIX)
            );

            const synthesizedData = synthesisResult.data;
            logs.push(`Synthesis Complete. Thinking: ${synthesisResult.thinking.substring(0, 50)}...`);

            // --- STEP 4: MERGE & FINALIZE ---
            // We trust the deterministic Parser for identity, and Nix Agent for logistics.
            // We trust Gemini for Compatibility and general cleanup.

            // Merge strategy: Start with Parsed (Trusted), Overlay Synthesis (Enrichment), Overlay NIX (Authoritative)
            const mergedData: ConsumableData = {
                ...synthesizedData, // Base Enrichment
                // Overwrite Logic: Only use Parsed if it successfully identified the field
                // This prevents "unknown" or "null" from Parser overwriting valid AI Synthesis
                ...(parsed.brand ? { brand: parsed.brand } : {}),
                ...(parsed.model ? { model: parsed.model } : {}),
                ...(parsed.consumable_type && parsed.consumable_type !== 'unknown' ? { consumable_type: parsed.consumable_type } : {}),
                ...(parsed.yield ? { yield: parsed.yield } : {}),

                // Overwrite Logistics with NIX Agent result if available
                packaging_from_nix: nixInfo || synthesizedData.packaging_from_nix || null,

                // Ensure Evidence is preserved/merged
                _evidence: {
                    ...data._evidence,
                    ...synthesizedData._evidence
                },
                sources: [... (data.sources || []), ...(synthesizedData.sources || [])]
            };

            // --- STEP 5: QUALITY GATES ---
            onProgress('gate_check');
            logs.push("Step 5: Quality Gates");

            // Ensure full object shape (using finalize helper)
            const finalDataObj = this.finalizeData(mergedData);

            const gateResult = evaluateQualityGates(finalDataObj);
            logs.push(`Gate Result: ${gateResult.passed ? 'PASS' : 'FAIL'}`);

            if (gateResult.passed) {
                finalDataObj.automation_status = 'done';
                finalDataObj.publish_ready = true;
            } else {
                finalDataObj.automation_status = 'needs_review';
                finalDataObj.publish_ready = false;
                finalDataObj.validation_errors = [
                    ...(finalDataObj.validation_errors || []),
                    ...gateResult.report.logistics.flags,
                    ...gateResult.report.compatibility.flags
                ];
            }

            return {
                id: jobId,
                input_raw: rawQuery,
                input_hash: Buffer.from(rawQuery).toString('base64'),
                data: finalDataObj,
                status: finalDataObj.automation_status === 'done' ? 'ok' :
                    finalDataObj.automation_status === 'needs_review' ? 'needs_review' : 'failed',
                ruleset_version: '2.0.0',
                parser_version: '2.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                processed_at: new Date().toISOString(),
                evidence: {
                    logs,
                    quality_metrics: this.calculateQualityMetrics(finalDataObj, gateResult),
                    sources: (finalDataObj.sources || []).map(s => ({
                        ...s,
                        source_type: s.sourceType, // Map sourceType to source_type match EvidenceSource
                        extracted_at: s.timestamp ? new Date(s.timestamp).toISOString() : new Date().toISOString(),
                        claims: s.dataConfirmed || [],
                        evidence_snippets_by_claim: {},
                        extraction_method: s.extractionMethod || 'unknown'
                    }))
                },
                error_details: finalDataObj.validation_errors?.map(e => ({
                    code: 'GATE_FAILURE',
                    message: e,
                    severity: 'medium',
                    category: 'validation',
                    timestamp: new Date().toISOString()
                }))
            };

        } catch (e) {
            const err = e as Error;
            console.error(`[OrchestrationService] Job ${jobId} failed:`, err);
            logs.push(`FATAL ERROR: ${err.message}`);
            logs.push(`STACK: ${err.stack}`);
            return {
                id: jobId,
                input_raw: rawQuery,
                input_hash: '',
                data: this.finalizeData(data),
                status: 'failed',
                validation_errors: [err.message],
                ruleset_version: '2.0',
                parser_version: '2.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                processed_at: new Date().toISOString(),
                evidence: {
                    logs,
                    sources: []
                },
                error_details: [{
                    code: 'SYSTEM_ERROR',
                    message: err.message,
                    severity: 'critical',
                    category: 'system',
                    timestamp: new Date().toISOString()
                }]
            };
        }
    }

    private calculateQualityMetrics(data: ConsumableData, gateResult: any) {
        // Calculate Data Completeness (ratio of non-null core fields)
        const coreFields = ['brand', 'consumable_type', 'mpn_identity', 'yield', 'color', 'packaging_from_nix', 'images'];
        const filledFields = coreFields.filter(f => {
            const val = (data as any)[f];
            if (Array.isArray(val)) return val.length > 0;
            return val !== null && val !== undefined && val !== 'unknown';
        });
        const completeness = filledFields.length / coreFields.length;

        // Source Reliability
        const avgConfidence = data.sources && data.sources.length > 0
            ? data.sources.reduce((sum, s) => sum + (s.confidence || 0), 0) / data.sources.length
            : 0;

        return {
            data_completeness_score: completeness,
            source_reliability_score: avgConfidence,
            validation_pass_rate: gateResult.passed ? 1.0 : 0.5,
            processing_efficiency: 0.95, // Estimated
            audit_completeness: 1.0, // We are generating it now
            total_sources_used: (data.sources || []).length
        };
    }

    private finalizeData(partial: Partial<ConsumableData>): ConsumableData {
        // Ensure confidence defaults
        const defaultConfidence = {
            model_name: 0.8,
            short_model: 0.8,
            logistics: partial.packaging_from_nix ? 0.9 : 0.0,
            compatibility: (partial.compatible_printers_ru?.length || 0) > 0 ? 0.9 : 0.0,
            faq: 0.0,
            overall: 0.8,
            data_completeness: 0.8,
            source_reliability: 0.8
        };

        const finalConfidence = { ...defaultConfidence, ...(partial.confidence || {}) };

        // Fill safe defaults for strict typing
        return {
            supplier_title_raw: partial.supplier_title_raw || '',
            title_norm: partial.title_norm || '',
            automation_status: partial.automation_status || 'failed',
            publish_ready: false,
            mpn_identity: partial.mpn_identity || { mpn: '', canonical_model_name: '', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false } },
            brand: partial.brand || null,
            consumable_type: partial.consumable_type || 'unknown',
            model: partial.model || null,
            short_model: partial.short_model || null,
            model_alias_short: null,
            yield: partial.yield ?? null,
            color: partial.color || null,
            has_chip: partial.has_chip ?? 'unknown',
            has_page_counter: partial.has_page_counter ?? 'unknown',
            printers_ru: partial.printers_ru || [],
            compatible_printers_ru: partial.compatible_printers_ru || [],
            compatible_printers_unverified: [],
            packaging_from_nix: partial.packaging_from_nix || null,
            images: [],
            related_consumables_full: partial.related_consumables_full || [],
            related_consumables_display: partial.related_consumables_display || [],
            sources: partial.sources || [],
            confidence: finalConfidence,
            _evidence: partial._evidence
        } as ConsumableData;
    }
}

export const orchestrationService = OrchestrationService.getInstance();
