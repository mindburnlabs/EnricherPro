
import { db } from "../src/db/index.js";
import { trustedCatalogPages } from "../src/db/schema_graph.js";
import { runIngestionLoop } from "../src/workflows/ingestionWorkflow.js";

async function main() {
    console.log("🌱 Seeding Trusted Catalog Pages...");

    const seedUrl = "https://www.nix.ru/price/lasers_hp.html";
    const domain = "nix.ru";

    try {
        await db.insert(trustedCatalogPages).values({
            url: seedUrl,
            domain: domain,
            status: 'active'
        }).onConflictDoNothing(); // Prevent duplicates

        console.log(`✅ Seeded: ${seedUrl}`);

        console.log("🚀 Triggering Ingestion Loop...");
        await runIngestionLoop();

    } catch (e) {
        console.error("❌ Failed to seed or ingest:", e);
    } finally {
        process.exit(0);
    }
}

main();
