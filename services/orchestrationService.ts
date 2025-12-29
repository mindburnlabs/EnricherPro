
import { v4 as uuidv4 } from 'uuid';
import {
    EnrichedItem,
    ConsumableData,
    ProcessingStep,
    AutomationStatus,
    DataSource,
    FieldEvidence
} from "../types/domain";
// Replacing ParserService with superior textProcessingService
import { processSupplierTitle } from './textProcessingService';
import { nixService } from './nixService';
import { perplexityService } from './perplexityService';
import { startCrawlJob, getCrawlJobStatus, crawlResultToMarkdown, deepAgentResearch, firecrawlScrape, mapWebsite, extractData } from './firecrawlService';
import { synthesizeConsumableData as synthesizeWithGemini } from './geminiService';
import { getOpenRouterService } from './openRouterService';
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

export type ProcessingEngine = 'gemini' | 'openrouter';

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
     * Unified SOTA Agentic Pipeline:
     * 1. Normalization & Advanced Text Processing (Deterministic)
     * 2. Agentic Research (Parallel: Logistics Agent + Source Discovery Agent)
     * 3. Synthesis (Engine Agnostic: Gemini 3.0 or OpenRouter)
     * 4. Quality Gates (Deterministic)
     */
    async processItem(
        rawQuery: string,
        onProgress: (step: ProcessingStep) => void,
        options: { engine: ProcessingEngine } = { engine: 'gemini' } // Default to Gemini
    ): Promise<EnrichedItem> {
        const jobId = uuidv4();
        // We use audit logs for internal tracing, but also keep a simple string log for the UI evidence.
        const logs: string[] = [`Job ${jobId} started for: "${rawQuery}" using engine: ${options.engine}`];

        // Initialize Data Object
        let data: Partial<ConsumableData> = {
            supplier_title_raw: rawQuery,
            sources: [],
            _evidence: {},
            automation_status: 'failed' // Default until pass
        };

        try {
            // --- STEP 1: NORMALIZATION & PARSING (Unified) ---
            onProgress('analyzing');
            logs.push("Step 1: Normalization & Advanced Parsing (TextProcessingService)");

            // Use the superior textProcessingService from OpenRouter pipeline
            const processedText = processSupplierTitle(rawQuery);
            const normTitle = processedText.normalized;
            logs.push(`Normalized: "${normTitle}"`);
            logs.push(`Detected: Brand=${processedText.brand.brand} (${Math.round(processedText.brand.confidence * 100)}%), Model=${processedText.model.model}`);

            // Map processed text to partial data
            data = {
                ...data,
                title_norm: normTitle,
                brand: processedText.brand.confidence > 0.6 ? processedText.brand.brand : null,
                model: processedText.model.confidence > 0.6 ? processedText.model.model : null,
                consumable_type: processedText.detectedType.value !== 'unknown' ? processedText.detectedType.value : 'unknown',
                // Map Yield if found
                yield: processedText.yieldInfo.length > 0 ? processedText.yieldInfo[0] : undefined
            };

            // Soft Fail: Don't throw if model missing, let Agent try to find it.
            if (!data.model) {
                logs.push("Warning: Model not identified during static parsing. Delegating to Research Agent.");
            }

            // --- STEP 2: AGENTIC RESEARCH (Parallel) ---
            onProgress('searching');
            logs.push("Step 2: Agentic Research (NIX Logistics + Sources)");

            const researchQuery = `${data.brand || ''} ${data.model || rawQuery} ${data.consumable_type !== 'unknown' ? data.consumable_type : ''}`;

            // Define research promises
            const researchPromises: Promise<any>[] = [
                // Agent A: Logistics (NIX.ru) - Try to get if we have a model, else use raw query might be risky but worth a try if model null
                data.model ? nixService.getPackagingInfo(data.model, data.brand || '') : Promise.resolve(null),
                // Agent B: Market & Compatibility
                // Use Perplexity for speed/breadth or Firecrawl for depth. 
                // Creating a Unified Research Result
                options.engine === 'openrouter'
                    ? getOpenRouterService()?.researchProductContext(rawQuery)
                    : perplexityService.discoverSources(researchQuery)
            ];

            const [nixInfo, discoveryResult] = await Promise.all(researchPromises);

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

            // Normalize Discovery Result
            let researchSummary = "";
            let researchUrls: string[] = [];

            // RETRY LOGIC: Resilient Research Pattern
            try {
                if (options.engine === 'openrouter') {
                    if (discoveryResult) {
                        researchSummary = discoveryResult.researchSummary;
                        researchUrls = discoveryResult.urls;
                    }
                } else {
                    if (discoveryResult) {
                        researchSummary = discoveryResult.summary;
                        researchUrls = discoveryResult.urls;
                    }
                }
            } catch (err) {
                console.warn("Primary research normalization failed:", err);
            }

            // Fallback strategy if primary research returned empty or failed
            if (!researchSummary || researchSummary.length < 50) {
                logs.push(`Primary Research (${options.engine}) yielded insufficient data. Attempting Switch-over...`);
                try {
                    const fallbackResult = options.engine === 'openrouter'
                        ? await perplexityService.discoverSources(researchQuery)
                        : await getOpenRouterService()?.researchProductContext(rawQuery);

                    if (fallbackResult) {
                        // Adapting result structure based on what was called
                        if (options.engine === 'openrouter') { // Fallback was Perplexity
                            const pr = fallbackResult as any;
                            researchSummary = pr.summary;
                            researchUrls = pr.urls;
                            logs.push("Fallback to Perplexity Successful.");
                        } else { // Fallback was OpenRouter
                            const or = fallbackResult as any;
                            researchSummary = or.researchSummary;
                            researchUrls = or.urls;
                            logs.push("Fallback to OpenRouter Research Successful.");
                        }
                    }
                } catch (fallbackErr) {
                    logs.push(`Fallback Research also failed: ${(fallbackErr as Error).message}`);
                }
            }

            if (options.engine === 'openrouter' && !researchSummary && discoveryResult) {
                // Original logic just in case
                // OpenRouter/Firecrawl format
                researchSummary = discoveryResult.researchSummary;
                researchUrls = discoveryResult.urls;
            } else if (options.engine !== 'openrouter' && !researchSummary && discoveryResult) {
                // Perplexity format
                researchSummary = discoveryResult.summary;
                researchUrls = discoveryResult.urls;
            }

            logs.push(`Discovery Agent: Found ${researchUrls.length} sources.`);

            // --- STEP 2.5: DEEP CONTENT EXTRACTION (Firecrawl Maximization) ---
            let deepScrapeContent = "";
            let structuredExtractionData: any = null;

            if (researchUrls.length > 0) {
                const highValueDomains = ['nix.ru', 'hp.com', 'canon', 'brother', 'epson', 'kyocera', 'xerox', 'ricoh', 'lexmark', 'cartridge.ru'];
                // Prioritize unique high-value domains, limit to 2 to avoid latency spikes
                const targetUrls = researchUrls
                    .filter((url, index, self) => highValueDomains.some(d => url.toLowerCase().includes(d)) && self.indexOf(url) === index)
                    .slice(0, 2);

                if (targetUrls.length > 0) {
                    logs.push(`Deep Research: Targeted Extraction on ${targetUrls.length} high-value URLs via Firecrawl...`);
                    try {
                        // INTELLIGENT EXTRACTION (v2)
                        // Instead of just scraping markdown, we ask Firecrawl to extract the JSON we need.
                        const extractionSchema = {
                            type: "object",
                            properties: {
                                brand: { type: "string" },
                                model: { type: "string" },
                                yield: { type: "object", properties: { value: { type: "number" }, unit: { type: "string" } } },
                                logistics: {
                                    type: "object",
                                    properties: {
                                        weight_g: { type: "number" },
                                        width_mm: { type: "number" },
                                        height_mm: { type: "number" },
                                        depth_mm: { type: "number" }
                                    }
                                }
                            }
                        };

                        const extractedData = await extractData(targetUrls, "Extract product specifications and package dimensions.", extractionSchema);

                        if (extractedData && extractedData.success && extractedData.data && extractedData.data.items) {
                            structuredExtractionData = extractedData.data.items;
                            logs.push(`Deep Research: Successfully extracted structured data from ${extractedData.data.items.length} pages.`);
                            deepScrapeContent = JSON.stringify(extractedData.data.items, null, 2);
                        } else {
                            // Falback to Scrape if Extract fails or returns empty (cost optimization or error)
                            logs.push("Deep Research: Extraction yielded no items, falling back to scrape...");
                            const scrapePromises = targetUrls.map(url => firecrawlScrape(url));
                            const scrapeResults = await Promise.all(scrapePromises);

                            deepScrapeContent = scrapeResults.map((res, idx) => {
                                if (res.success && res.data.markdown) {
                                    const content = res.data.markdown.substring(0, 8000);
                                    return `### DEEP SCRAPE OF: ${targetUrls[idx]}\n${content}\n\n`;
                                }
                                return "";
                            }).join("\n");
                        }

                    } catch (scrapeErr) {
                        logs.push(`Deep Research Warning: Extraction/Scrape failed - ${(scrapeErr as Error).message}`);
                    }
                }
            }

            // --- STEP 3: SYNTHESIS (Engine Agnostic) ---
            onProgress('analyzing');
            logs.push(`Step 3: Synthesis (${options.engine})`);

            const synthesisContext = `
            [PARSED_IDENTITY]
            Brand: ${data.brand}
            Model: ${data.model}
            Type: ${data.consumable_type}
            
            [LOGISTICS_DATA]
            ${JSON.stringify(nixInfo || { status: 'missing' })}
            
            [RESEARCH_SUMMARY]
            ${researchSummary}
            
            [DEEP_RESEARCH_CONTENT]
            ${deepScrapeContent}

            [DISCOVERED_URLS]
            ${researchUrls.join('\n')}
            `;

            let synthesisResult;

            if (options.engine === 'openrouter') {
                const orService = getOpenRouterService();
                if (!orService) throw new Error("OpenRouter service not initialized");
                synthesisResult = await orService.synthesizeConsumableData(synthesisContext, rawQuery, processedText);
            } else {
                // Default Gemini
                try {
                    synthesisResult = await synthesizeWithGemini(
                        synthesisContext,
                        researchQuery,
                        processedText, // Use full textProcessingResult for consistency
                        undefined
                    );
                } catch (geminiError) {
                    logs.push(`Gemini Synthesis Failed: ${(geminiError as Error).message}. Switching to OpenRouter.`);
                    const orService = getOpenRouterService();
                    if (!orService) throw new Error("OpenRouter service not initialized for fallback");
                    synthesisResult = await orService.synthesizeConsumableData(synthesisContext, rawQuery, processedText);
                }
            }

            const synthesizedData = synthesisResult.data;
            logs.push(`Synthesis Complete. Thinking: ${synthesisResult.thinking.substring(0, 50)}...`);

            // --- STEP 4: MERGE & FINALIZE ---
            // Merge strategy: Start with Synthesized (smartest), Overwrite with Deterministic Logic
            const mergedData: ConsumableData = {
                ...synthesizedData,

                // Overwrite Logic: Trust TextProcessor if high confidence, else trust LLM
                // If static parser was very confident, we might prefer it, but LLM usually sees context.
                ...(data.brand ? { brand: data.brand } : {}),
                ...(data.model ? { model: data.model } : {}),
                ...(data.consumable_type && data.consumable_type !== 'unknown' ? { consumable_type: data.consumable_type } : {}),
                ...(data.yield ? { yield: data.yield } : {}),

                // However, NIX data is authoritative.
                packaging_from_nix: nixInfo || synthesizedData.packaging_from_nix || null,

                // Ensure Evidence is preserved/merged
                _evidence: {
                    ...data._evidence,
                    ...synthesizedData._evidence
                },
                sources: [... (data.sources || []), ...(synthesizedData.sources || [])]
            };

            // --- STEP 5: QUALITY GATES (Unified) ---
            onProgress('gate_check');
            logs.push("Step 5: Quality Gates");

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
                parser_version: '2.0.0', // Updated to indicate new pipeline
                created_at: Date.now(),
                updated_at: Date.now(),
                processed_at: new Date().toISOString(),
                evidence: {
                    logs,
                    quality_metrics: this.calculateQualityMetrics(finalDataObj, gateResult),
                    sources: (finalDataObj.sources || []).map(s => ({
                        ...s,
                        source_type: s.sourceType,
                        extracted_at: s.timestamp ? new Date(s.timestamp).toISOString() : new Date().toISOString(),
                        claims: s.dataConfirmed || [],
                        evidence_snippets_by_claim: {},
                        extraction_method: s.extractionMethod || 'unknown'
                    })),
                    thinking_process: synthesisResult.thinking
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
            console.error(`[OrchestrationService] Unified Job ${jobId} failed:`, err);
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
