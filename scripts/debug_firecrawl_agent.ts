
import dotenv from 'dotenv';
import { DiscoveryAgent } from '../src/services/agents/DiscoveryAgent.js';
import { BackendFirecrawlService } from '../src/services/backend/firecrawl.js';

dotenv.config();

async function run() {
    console.log("1. Testing DiscoveryAgent Planning...");
    try {
        const plan = await DiscoveryAgent.plan(
            "Canon C-EXV 42 specs",
            'deep', // Force DEEP mode
            process.env.OPENROUTER_API_KEY ? { openRouter: process.env.OPENROUTER_API_KEY } : undefined
        );
        console.log("Plan Result:", JSON.stringify(plan, null, 2));

        const agentStrategy = plan.strategies.find(s => s.type === 'firecrawl_agent');
        if (!agentStrategy) {
            console.error("❌ FAILURE: DiscoveryAgent did NOT generate a 'firecrawl_agent' strategy in Deep mode.");
        } else {
            console.log("✅ SUCCESS: DiscoveryAgent planned a firecrawl_agent task.");
            console.log("Schema:", JSON.stringify(agentStrategy.schema, null, 2));

            console.log("\n2. Testing BackendFirecrawlService.agent()...");
            if (!process.env.FIRECRAWL_API_KEY) {
                console.warn("⚠️ SKIPPING EXECUTION: No FIRECRAWL_API_KEY in env.");
                return;
            }

            try {
                const query = agentStrategy.queries[0];
                console.log(`Executing Agent with query: "${query}"...`);

                const data = await BackendFirecrawlService.agent(query, {
                    apiKey: process.env.FIRECRAWL_API_KEY,
                    schema: agentStrategy.schema
                });

                console.log("Agent Response:", JSON.stringify(data, null, 2));

                if (data) {
                    console.log("\n3. Testing Direct Ingestion Parsing...");
                    // Simulate ingestion logic from researchWorkflow.ts
                    try {
                        // Agent returns generic object, let's treat it as the markdown/json payload
                        const payload = JSON.stringify(data);
                        const parsed = JSON.parse(payload);
                        console.log("✅ Parsed JSON successfully:", parsed);
                    } catch (e) {
                        console.error("❌ FAILURE: Ingestion parsing failed:", e);
                    }
                } else {
                    console.error("❌ FAILURE: Agent returned null/empty data.");
                }

            } catch (e) {
                console.error("❌ FAILURE: BackendFirecrawlService execution failed:", e);
            }
        }

    } catch (e) {
        console.error("❌ FAILURE: Planning failed:", e);
    }
}

run();
