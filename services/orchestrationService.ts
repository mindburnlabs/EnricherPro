
import { v4 as uuidv4 } from 'uuid';
import {
    EnrichedItem,
    ConsumableData,
    ProcessingStep,
    AutomationStatus,
    DataSource,
    FieldEvidence
} from "../types/domain";
import { Result, Ok, Err } from '../types/sota';
// Replacing ParserService with superior textProcessingService
import { processSupplierTitle } from './textProcessingService';
import { deepResearchService } from './deepResearchService';
import { evaluateQualityGates } from './qualityGates';

export interface WorkflowState {
    id: string;
    stage: ProcessingStep;
    query: string;
    normalizedTitle?: string;
    parsedData?: Partial<ConsumableData>;
    nixData?: any;
    searchUrls: string[];
    logs: string[];
    error?: string;
    finalData?: ConsumableData;
}

// Update ProcessingEngine type - ONLY Firecrawl supported now
export type ProcessingEngine = 'firecrawl';

interface ResearchResult {
    nixInfo: any;
    researchSummary: string; // Deprecated/Empty in Firecrawl-only
    researchUrls: string[];
    deepScrapeContent: string;
    structuredExtractionData: any;
}

class OrchestrationService {
    private static instance: OrchestrationService;

    private constructor() { }

    public static getInstance(): OrchestrationService {
        if (!OrchestrationService.instance) {
            OrchestrationService.instance = new OrchestrationService();
        }
        return OrchestrationService.instance;
    }

    // SOTA 2025: Type-Safe Agent Execution Wrapper
    private async executeAgent<T>(
        name: string,
        promise: Promise<T>
    ): Promise<Result<T>> {
        try {
            const data = await promise;
            return Ok(data);
        } catch (e) {
            return Err(e as Error);
        }
    }

    private getError(result: Result<any>): string {
        if (!result.success) {
            return (result as { success: false; error: Error }).error.message;
        }
        return 'Unknown Error';
    }

    public async processItem(
        rawQuery: string,
        onProgress: (stage: ProcessingStep) => void = () => { },
        options: { engine: ProcessingEngine, mode?: 'fast' | 'standard' | 'exhaustive', locale?: string, strictSources?: boolean } = { engine: 'firecrawl' },
        onLog?: (msg: string) => void
    ): Promise<EnrichedItem> {
        const jobId = uuidv4();
        const logs: string[] = [];
        const log = (msg: string) => {
            logs.push(msg);
            if (onLog) onLog(msg);
        };

        log("Pivot: Enforcing Firecrawl-Only Architecture");

        // Default mode
        const mode = options.mode || 'standard';
        const locale = options.locale || 'RU';
        const strictSources = options.strictSources !== undefined ? options.strictSources : true;

        try {
            onProgress('discovery');
            // Execute Deep Research (Firesearch Workflow) with streaming updates
            const researchResult = await deepResearchService.executeWorkflow(
                rawQuery,
                mode,
                locale,
                strictSources,
                onLog // Pass the callback directly
            );

            logs.push(...researchResult.logs);

            // --- STEP 3: FINALIZATION ---
            onProgress('enrichment');

            const finalDataObj = researchResult.data;

            // Construct Final Item
            return this.constructEnrichedItem(jobId, rawQuery, finalDataObj, logs, [], "Firesearch Native Optimization");

        } catch (e) {
            return this.handleFatalError(jobId, rawQuery, {}, logs, e as Error);
        }
    }

    private runNormalizationPhase(rawQuery: string, logs: string[]) {
        logs.push(`Step 1: Normalization & Parsing for "${rawQuery}"`);

        // Use the comprehensive textProcessingService
        const processedText = processSupplierTitle(rawQuery);

        const data: Partial<ConsumableData> = {};

        // Map parsed data to local context
        if (processedText.brand.brand) data.brand = processedText.brand.brand;
        if (processedText.model.model) data.model = processedText.model.model;
        if (processedText.detectedType.value !== 'unknown') data.consumable_type = processedText.detectedType.value;
        if (processedText.detectedColor.value) data.color = processedText.detectedColor.value;
        if (processedText.yieldInfo.length > 0) {
            data.yield = {
                value: processedText.yieldInfo[0].value,
                unit: processedText.yieldInfo[0].unit
            };
        }

        return { processedText, partialData: data };
    }

    // runResearchPhase removed as part of Firesearch refactoring.

    private constructEnrichedItem(
        jobId: string,
        rawQuery: string,
        finalDataObj: ConsumableData,
        logs: string[],
        researchUrls: string[],
        thinking: string
    ): EnrichedItem {
        return {
            id: jobId,
            input_raw: rawQuery,
            input_hash: btoa(unescape(encodeURIComponent(rawQuery))),
            data: finalDataObj,
            status: finalDataObj.automation_status === 'done' ? 'ok' :
                finalDataObj.automation_status === 'needs_review' ? 'needs_review' : 'failed',
            ruleset_version: '2.5.0-SOTA',
            parser_version: '2.0.0',
            created_at: Date.now(),
            updated_at: Date.now(),
            processed_at: new Date().toISOString(),
            evidence: {
                logs,
                // We don't have gateResult here easily available unless we return it from loop or calculate again.
                // Calculating again is cheap but needs gateResult object.
                // Or we can return gateResult from loop.
                // For simplicity, let's recalculate metrics.
                quality_metrics: this.calculateQualityMetrics(finalDataObj, evaluateQualityGates(finalDataObj)),
                sources: (finalDataObj.sources || []).map(s => ({
                    ...s,
                    source_type: s.sourceType,
                    extracted_at: s.timestamp ? new Date(s.timestamp).toISOString() : new Date().toISOString(),
                    claims: s.dataConfirmed || [],
                    evidence_snippets_by_claim: {},
                    extraction_method: s.extractionMethod || 'unknown'
                })),
                thinking_process: thinking
            },
            // Logic to add error details based on status
            error_details: finalDataObj.validation_errors?.map(e => ({
                code: 'GATE_FAILURE',
                message: e,
                severity: 'medium',
                category: 'validation',
                timestamp: new Date().toISOString()
            }))
        };
    }

    private handleFatalError(
        jobId: string,
        rawQuery: string,
        data: Partial<ConsumableData>,
        logs: string[],
        err: Error
    ): EnrichedItem {
        console.error(`[OrchestrationService] Unified Job ${jobId} failed: `, err);
        logs.push(`FATAL ERROR: ${err.message} `);
        logs.push(`STACK: ${err.stack} `);
        return {
            id: jobId,
            input_raw: rawQuery,
            input_hash: '',
            data: this.finalizeData(data),
            status: 'failed',
            validation_errors: [err.message],
            ruleset_version: '2.0', // Fallback version
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
            audit_completeness: 1.0,
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
            images: partial.images || [],
            related_consumables_full: partial.related_consumables_full || [],
            related_consumables_display: partial.related_consumables_display || [],
            sources: partial.sources || [],
            confidence: finalConfidence,
            _evidence: partial._evidence
        } as ConsumableData;
    }
}

export const orchestrationService = OrchestrationService.getInstance();
