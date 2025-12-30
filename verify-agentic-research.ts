
import { deepResearchService } from './services/deepResearchService';
import { orchestrationService } from './services/orchestrationService';
import dotenv from 'dotenv';
dotenv.config();

// MOCK Browser Environment features usually needed
if (!global.localStorage) {
    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { }
    } as any;
}

async function runVerification() {
    console.log("=== Starting Agentic Research Verification ===");

    // Test Query: "W1331X specs" - Specific enough to test Plan -> Search -> Extract
    const query = "W1331X specs";

    console.log(`\n1. Testing DeepResearchService directly: "${query}"`);

    try {
        const result = await deepResearchService.executeWorkflow(
            query,
            'standard',
            'RU',
            true,
            (log) => console.log(`[Stream] ${log}`)
        );

        console.log("\n>>> Workflow Complete <<<");
        console.log("Status:", result.status);
        if (result.data) {
            console.log("Brand:", result.data.brand);
            console.log("Model:", result.data.model);
            console.log("Logistics Found:", !!result.data.packaging);
            if (result.data.packaging) {
                console.log(" Weight:", result.data.packaging.package_weight_g);
                console.log(" Dims:", result.data.packaging.package_mm);
            }
            console.log("Sources:", result.data.packaging?.evidence_urls || result.data.sources?.map(s => s.url));
        }

    } catch (e) {
        console.error("DeepResearch failed:", e);
    }

    /*
    console.log(`\n2. Testing OrchestrationService (Full Pipeline): "${query}"`);
    try {
        const item = await orchestrationService.processItem(
            query,
            (stage) => console.log(`[Stage] ${stage}`),
            { engine: 'firecrawl' },
            (log) => {} // Suppress duplicate logs
        );
        console.log("\n>>> Orchestration Complete <<<");
        console.log("Item Status:", item.status);
        console.log("Metrics:", item.evidence.quality_metrics);
    } catch (e) {
        console.error("Orchestration failed:", e);
    }
    */
}

runVerification();
