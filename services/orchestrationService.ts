import { v4 as uuidv4 } from 'uuid';
import { EnrichedItem, ConsumableData, ProcessingStep, FieldEvidence } from "../types";
import { perplexityService } from './perplexityService';
import { startCrawlJob, getCrawlJobStatus, crawlResultToMarkdown } from './firecrawlService';
import { apiIntegrationService } from './apiIntegrationService'; // For Gemini/OpenRouter logic if needed here or via existing services
// Actually, let's keep synthesis in geminiService but call a specific "synthesize" method. 
// We need to modify geminiService to export `synthesizeConsumableData` publically or similar.

// For now, let's define the Orchestrator structure.

export type OrchestrationStage = 'search' | 'filter' | 'scrape' | 'synthesize' | 'gate_check' | 'complete' | 'failed';

export interface WorkflowState {
    stage: OrchestrationStage;
    query: string;
    jobId: string;
    searchUrls: string[];
    scrapeJobId?: string;
    scrapedContent?: string;
    data?: ConsumableData;
    error?: string;
    logs: string[];
}

export class OrchestrationService {
    private static instance: OrchestrationService;

    // Simple in-memory rate limiter / token bucket can be managed via apiIntegrationService which already exists.
    // We will leverage apiIntegrationService for the heavy lifting of rate limiting.

    private constructor() { }

    public static getInstance(): OrchestrationService {
        if (!OrchestrationService.instance) {
            OrchestrationService.instance = new OrchestrationService();
        }
        return OrchestrationService.instance;
    }

    /**
     * Main entry point for the RU-market pipeline.
     */
    async processItem(query: string, onProgress: (step: ProcessingStep) => void): Promise<EnrichedItem> {
        const jobId = uuidv4();
        const state: WorkflowState = {
            stage: 'search',
            query,
            jobId,
            searchUrls: [],
            logs: [`Started job ${jobId} for query: ${query}`]
        };

        try {
            // 1. SEARCH: Sonar
            onProgress('searching');
            state.logs.push("Starting Search Phase with Perplexity Sonar...");
            const searchResult = await perplexityService.discoverSources(query);
            state.searchUrls = searchResult.urls;
            state.logs.push(`Found ${state.searchUrls.length} candidate URLs.`);

            // Filter logic (simple for now: take top 10 unique)
            const urlsToScrape = state.searchUrls.slice(0, 10);

            // 2. SCRAPE: Firecrawl Async
            onProgress('scraping_nix'); // Re-using existing step name for general scraping
            state.stage = 'scrape';
            state.logs.push(`Starting crawl for ${urlsToScrape.length} URLs...`);

            const crawlStart = await startCrawlJob(urlsToScrape);
            if (!crawlStart.success || !crawlStart.jobId) throw new Error(`Crawl failed to start: ${crawlStart.error}`);
            state.scrapeJobId = crawlStart.jobId;

            // Poll for completion
            let attempts = 0;
            let crawlData = null;
            while (attempts < 30) { // 30 * 2s = 60s max wait
                await new Promise(r => setTimeout(r, 2000));
                const status = await getCrawlJobStatus(state.scrapeJobId!);
                if (status.status === 'completed') {
                    crawlData = status;
                    break;
                }
                if (status.status === 'failed') throw new Error(`Crawl job failed: ${status.error}`);
                attempts++;
            }

            if (!crawlData) throw new Error("Crawl timeout");
            state.scrapedContent = crawlResultToMarkdown(crawlData);
            state.logs.push("Scraping completed.");

            // 3. SYNTHESIZE: Gemini
            onProgress('analyzing');
            state.stage = 'synthesize';
            state.logs.push("Starting Synthesis...");

            // Dynamically import to avoid circular dependency issues if any
            const { synthesizeConsumableData, processSupplierTitle } = await import('./geminiService');

            // Quick text processing (re-using service logic)
            const textProcessingResult = processSupplierTitle(query);

            // Perform Synthesis
            const synthResult = await synthesizeConsumableData(
                state.scrapedContent || '',
                query,
                textProcessingResult,
                // If we had Firecrawl agent data we would pass it here, currently using general scrape
                undefined
            );

            state.data = synthResult.data;
            state.logs.push("Synthesis completed.");

            // 4. GATE CHECK
            state.stage = 'gate_check';
            onProgress('analyzing');

            if (state.data) {
                const { evaluateQualityGates } = await import('./qualityGates');
                const gateResult = evaluateQualityGates(state.data);

                state.logs.push(`Gate Check: ${gateResult.passed ? 'PASSED' : 'FAILED'}`);
                if (!gateResult.passed) {
                    state.logs.push(`Details: ${JSON.stringify(gateResult.report)}`);
                    if (state.data.confidence) {
                        state.data.confidence.overall = Math.min(state.data.confidence.overall || 1, 0.5);
                    }
                }
            }

            state.stage = 'complete';

        } catch (e) {
            state.stage = 'failed';
            state.error = (e as Error).message;
            state.logs.push(`Error: ${state.error}`);
        }

        return {
            id: jobId,
            input_raw: query,
            data: state.data!,
            evidence: {
                sources: [], // TODO: extract from state.data._evidence or similar
                processing_history: [],
                quality_metrics: {} as any,
                audit_trail: []
            },
            status: state.error ? 'failed' : 'ok',
            validation_errors: state.error ? [state.error] : [],
            error_details: [],
            failure_reasons: [],
            retry_count: 0,
            is_retryable: false,
            created_at: Date.now(),
            updated_at: Date.now(),
            job_run_id: jobId,
            input_hash: 'hash',
            ruleset_version: '2.0',
            parser_version: '2.0',
            processed_at: new Date().toISOString()
        };
    }
}

export const orchestrationService = OrchestrationService.getInstance();
