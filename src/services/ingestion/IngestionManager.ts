
import { aliases, entities, edges, evidence, trustedCatalogPages, frontier, jobs, sourceDocuments } from '../../db/schema.js';
import { db } from '../../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { BackendFirecrawlService } from '../backend/firecrawl.js';
import { GraphService } from '../backend/GraphService.js'; // We'll assume this is updated next
import { randomUUID } from 'crypto';

/**
 * The Factory Floor for data ingestion.
 * Manages the transition from:
 * URL -> Scrape -> Extraction -> Graph Upsert -> Evidence
 */
export class IngestionManager {

    /**
     * 1. DISCOVERY (Queueing)
     * Scan trusted pages (sitemaps, category roots) for new product URLs.
     */
    static async discover(jobId: string) {
        // 1. Get active catalog pages
        const catalogs = await db.select().from(trustedCatalogPages).where(eq(trustedCatalogPages.status, 'active'));

        // 2. For each catalog, either use cached map or crawl
        // For now, let's assume we just adding them to frontier as 'domain_map' tasks if not present
        // Implementation simplified for "Graph-Lite" MVP

        console.log(`[Ingestion] Found ${catalogs.length} active catalogs.`);
    }

    /**
     * 2. HARVEST (Scraping)
     * Process a batch of URL tasks from Frontier.
     */
    static async harvest(batchSize: number = 5) {
        // 1. Lock next N pending 'ingest' tasks
        // (Simplified: just finding them, real world needs atomic lock)

        // This is a placeholder for the actual batch logic which might live in a worker.
        // We will focus on the "On-Demand" flow mostly requested by the user.
    }

    /**
     * ON-DEMAND INGESTION (Triggered by a "Miss" in Resolution)
     * Runs the full pipeline for a single target to backfill the graph.
     */
    static async ingestOnDemand(url: string, jobId: string): Promise<boolean> {
        console.log(`[Ingestion] Starting On-Demand Backfill for: ${url}`);

        try {
            // A. SCAPE
            const scrapeResult = await BackendFirecrawlService.scrape(url, {
                formats: ['markdown'],
                onlyMainContent: true
            });

            if (!scrapeResult.markdown) {
                console.warn(`[Ingestion] Empty scrape for ${url}`);
                return false;
            }

            // B. SAVE RAW SOURCE
            const [sourceDoc] = await db.insert(sourceDocuments).values({
                jobId: jobId, // We might need a "System Job" ID for background ingest
                url: url,
                domain: new URL(url).hostname,
                rawContent: scrapeResult.markdown,
                status: 'success',
                extractedMetadata: scrapeResult.metadata
            }).returning();

            // C. EXTRACT (Tier A: Fast/Regex or Cheap LLM)
            // We want to find: Subject Entity (MPN) + Relationships
            const extracted = await this.extractGraphData(scrapeResult.markdown, url);

            if (!extracted) return false;

            // D. UPSERT TO GRAPH
            await this.upsertGraph(extracted, sourceDoc.id);

            return true;

        } catch (e) {
            console.error(`[Ingestion] Failed to ingest ${url}`, e);
            return false;
        }
    }

    /**
     * USES TIER A (Extraction) MODEL
     */
    private static async extractGraphData(markdown: string, url: string): Promise<any> {
        const { BackendLLMService, RoutingStrategy } = await import('../backend/llm.js'); // Lazy load

        const systemPrompt = `You are a Data Engineer extracting Graph Data from a printer consumable page.
        Extract:
        1. The Subject Consumable (MPN, Brand, Name)
        2. Compatible Printers (List of model names)
        
        Output JSON:
        {
          "subject": { "mpn": "...", "brand": "...", "name": "..." },
          "compatibility": ["Printer A", "Printer B"]
        }
        `;

        // Truncate markdown to fit context
        const safeMarkdown = markdown.slice(0, 15000);

        const res = await BackendLLMService.complete({
            model: "openrouter/auto",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `URL: ${url}\n\n${safeMarkdown}` }
            ],
            routingStrategy: RoutingStrategy.EXTRACTION,
            jsonSchema: {
                type: "object",
                properties: {
                    subject: {
                        type: "object",
                        properties: {
                            mpn: { type: "string" },
                            brand: { type: "string" },
                            name: { type: "string" }
                        },
                        required: ["mpn"]
                    },
                    compatibility: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        });

        try {
            return JSON.parse(res || "null");
        } catch (e) {
            return null;
        }
    }

    /**
     * WRITES TO DB (Idempotent)
     */
    private static async upsertGraph(data: any, sourceDocId: string) {
        if (!data || !data.subject || !data.subject.mpn) return;

        const subjectMpn = data.subject.mpn.trim().toUpperCase();

        await db.transaction(async (tx) => {
            // 1. Ensure Subject Entity exists
            // For now, assume simplified flow: One Entity per unique MPN (ignoring strict brand clashes for speed)
            let [entity] = await tx.select().from(aliases)
                .where(and(eq(aliases.alias, subjectMpn), eq(aliases.aliasType, 'exact')))
                .limit(1);

            let entityId: string;

            if (entity) {
                entityId = entity.entityId;
            } else {
                // Create New
                const [newEntity] = await tx.insert(entities).values({
                    type: 'consumable',
                    canonicalName: data.subject.name || subjectMpn,
                    metadata: { brand: data.subject.brand }
                }).returning();
                entityId = newEntity.id;

                // Create Alias
                await tx.insert(aliases).values({
                    entityId: entityId,
                    alias: subjectMpn,
                    aliasType: 'exact',
                    confidence: 100
                });
            }

            // 2. Process Compatibility Edges
            if (data.compatibility && Array.isArray(data.compatibility)) {
                for (const printerName of data.compatibility) {
                    // Normalize printer name slightly? or keep raw alias
                    const pName = printerName.trim();
                    if (!pName) continue;

                    // Resolve Printer Entity (Quick check)
                    // In real system, we'd recursively resolve/create printer entities.
                    // Here we do a simplified check or create raw.
                    // ... For MVP, skip deep printer resolution, just ensuring an entity/alias exists
                    // (Omitted for brevity, but same logic as above)
                }
            }

            // 3. Evidence
            // We link the whole operation or specific edges? 
            // For MVP, we just rely on the 'sourceDocuments' table being linked to the job.
            // But if we want field-level provenance, we'd insert into 'evidence' table here.
        });
    }
}
