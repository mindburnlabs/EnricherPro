// workflow: ingestion-loop
import { IngestionAgent } from "../services/agents/IngestionAgent.js";
import { BackendFirecrawlService } from "../services/backend/firecrawl.js";
import { db } from "../db/index.js";
import { trustedCatalogPages } from "../db/schema_graph.js";
import { eq } from "drizzle-orm";

/**
 * The "Crawler" loop.
 * 1. Fetches trusted pages.
 * 2. Scrapes them.
 * 3. Ingests Items to Graph.
 */
export async function runIngestionLoop() {
    console.log("🐛 Starting Ingestion Loop...");

    // 1. Get Active Pages
    const pages = await db.query.trustedCatalogPages.findMany({
        where: (t, { eq }) => eq(t.status, 'active')
    });

    if (pages.length === 0) {
        console.log("No active pages to ingest.");
        // Seed if empty?
        // For simulation, let's assume one.
    }

    for (const page of pages) {
        try {
            console.log(`Processing ${page.url}...`);

            // 2. Scrape
            const result = await BackendFirecrawlService.scrape(page.url, { formats: ['markdown'] });

            if (result.markdown) {
                // 3. Extract
                const items = await IngestionAgent.parseCatalog(result.markdown, page.domain);
                console.log(`Extracted ${items.length} items.`);

                // 4. Ingest
                const ingested = await IngestionAgent.processItems(items, 'catalog_ingest');
                console.log(`Ingested ${ingested} new graph edges.`);

                // Update Timestamp
                await db.update(trustedCatalogPages)
                    .set({ lastScrapedAt: new Date() })
                    .where(eq(trustedCatalogPages.id, page.id));
            }

        } catch (e) {
            console.error(`Failed to ingest ${page.url}`, e);
        }
    }

    console.log("✅ Ingestion Loop Complete.");
}
