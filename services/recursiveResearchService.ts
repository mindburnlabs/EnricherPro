import { ConsumableData, EnrichedItem } from "../types";
import { deepAgentResearch } from "./firecrawlService";
import { createAuditTrailEntry, createInputHash } from "./auditTrailService";

export interface ResearchGap {
    field: string;
    reason: string;
    priority: 'critical' | 'high' | 'medium';
    searchQuery: string;
}

export interface RecursiveResearchResult {
    hasUpdates: boolean;
    newContext: string;
    resolvedGaps: string[];
    auditEntries: any[];
}

export class RecursiveResearchService {
    private static MAX_DEPTH = 3;

    /**
     * Analyze the current data to identify missing critical information.
     */
    static identifyGaps(data: ConsumableData, brandArg?: string, modelArg?: string): ResearchGap[] {
        const gaps: ResearchGap[] = [];
        const brand = data.brand || brandArg || 'Printer Consumable';
        const model = data.model || modelArg || 'Unknown Model';

        // 1. Critical: Logistics from NIX.ru
        if (!data.packaging_from_nix || !data.packaging_from_nix.weight_g || !data.packaging_from_nix.width_mm) {
            gaps.push({
                field: 'packaging_from_nix',
                reason: 'Missing verified logistics data (weight/dimensions)',
                priority: 'critical',
                searchQuery: `site:nix.ru ${brand} ${model} dimensions weight package`
            });
        }

        // 2. Critical: Exact MPN
        if (!data.model || data.model.includes('Unknown')) {
            gaps.push({
                field: 'model',
                reason: 'Missing exact Manufacturer Part Number (MPN)',
                priority: 'critical',
                searchQuery: `${brand} ${model} manufacturer part number official specification`
            });
        }

        // 3. High: Compatibility
        if (!data.compatible_printers_ru || data.compatible_printers_ru.length === 0) {
            gaps.push({
                field: 'compatible_printers_ru',
                reason: 'No confirmed compatible printers for Russian market',
                priority: 'high',
                searchQuery: `${brand} ${model} compatible printers russian market cartridge.ru rashodnika.net`
            });
        }

        // 4. Medium: Yield
        if (!data.yield || !data.yield.value) {
            gaps.push({
                field: 'yield',
                reason: 'Missing yield information',
                priority: 'medium',
                searchQuery: `${brand} ${model} page yield capacity specifications`
            });
        }

        return gaps;
    }

    /**
     * Execute targeted research for the identified gaps.
     */
    static async huntForGaps(
        data: ConsumableData,
        gaps: ResearchGap[],
        inputRaw: string
    ): Promise<RecursiveResearchResult> {
        if (gaps.length === 0) {
            return { hasUpdates: false, newContext: '', resolvedGaps: [], auditEntries: [] };
        }

        console.log(`[RecursiveResearch] Hunting for ${gaps.length} gaps: ${gaps.map(g => g.field).join(', ')}`);

        let combinedContext = '';
        const resolvedGaps: string[] = [];
        const auditEntries: any[] = [];
        const urlsFound: string[] = [];

        // Process critical gaps first, then high
        const targetGaps = gaps.filter(g => g.priority === 'critical' || g.priority === 'high').slice(0, 2); // Batch max 2 queries per step to save time

        // Use Firecrawl Agent for the most critical gap to get deep research
        // We combine queries if they are related, or pick the most critical one
        const primaryGap = targetGaps[0];

        if (primaryGap) {
            const researchStart = Date.now();
            try {
                console.log(`[RecursiveResearch] Executing deep agent research for: ${primaryGap.searchQuery}`);

                // We use the inputRaw as context for the agent, but focus the prompt on the gap
                const agentResult = await deepAgentResearch(
                    primaryGap.searchQuery,
                    data.brand || undefined
                );

                if (agentResult) {
                    combinedContext += `\n[RECURSIVE RESEARCH FOR ${primaryGap.field}]\n`;
                    combinedContext += `Query: ${primaryGap.searchQuery}\n`;
                    combinedContext += `Findings: ${JSON.stringify(agentResult)}\n`;

                    resolvedGaps.push(primaryGap.field);

                    if (agentResult.nix_logistics && agentResult.nix_logistics.source_url) {
                        urlsFound.push(agentResult.nix_logistics.source_url);
                    }
                    if (agentResult.compatibility && agentResult.compatibility.sources) {
                        agentResult.compatibility.sources.forEach((s: any) => urlsFound.push(s.url));
                    }

                    auditEntries.push(createAuditTrailEntry(
                        'enrichment',
                        'recursiveResearchService.huntForGaps',
                        `Targeted research for ${primaryGap.field} completed`,
                        {
                            inputHash: createInputHash(primaryGap.searchQuery),
                            processingTimeMs: Date.now() - researchStart,
                            dataFieldsAffected: [primaryGap.field],
                            sourceUrls: urlsFound
                        }
                    ));
                }
            } catch (error) {
                console.error(`[RecursiveResearch] Step failed for ${primaryGap.field}:`, error);
                auditEntries.push(createAuditTrailEntry(
                    'error_handling',
                    'recursiveResearchService.huntForGaps',
                    `Targeted research failed for ${primaryGap.field}: ${(error as Error).message}`,
                    {
                        // query: primaryGap.searchQuery,
                        processingTimeMs: Date.now() - researchStart
                    }
                ));
            }
        }

        return {
            hasUpdates: resolvedGaps.length > 0,
            newContext: combinedContext,
            resolvedGaps,
            auditEntries
        };
    }
}
