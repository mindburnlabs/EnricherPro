
import { deepResearchService } from './services/deepResearchService';
import { retrieverAgent } from './services/agents/retriever';
import { geminiService } from './services/geminiService';
import dotenv from 'dotenv';
dotenv.config();

// MOCK Browser Environment
if (!global.localStorage) {
    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { }
    } as any;
}

// 1. Mock Retriever Agent (Bypass failing Firecrawl)
retrieverAgent.execute = async (step: any) => {
    console.log(`[MockRetriever] Skipping real search for: ${step.description}`);
    // Return fake findings
    return [
        {
            title: 'W1331X Specs - NIX',
            sourceUrl: 'https://test-nix.ru/item/12345',
            timestamp: Date.now(),
            content: `
                Official Specifications for W1331X (1331X) Cartridge:
                - Model: W1331X
                - Brand: HP
                - Yield: 15000 pages
                - Color: Black
                - Packaging Dimensions: 362 x 102 x 198 mm
                - Packaging Weight: 0.9 kg (900 g)
                - Compatible Printers: HP Laser 408dn, HP Laser 432fdn
            `,
            relevance: 1
        },
        {
            title: 'Conflicting Store - W1331X',
            sourceUrl: 'https://bad-store.ru/item/fake',
            timestamp: Date.now(),
            content: `
                 Specs:
                 Weight: 1.2 kg (1200 g)
                 Dimensions: 360 x 100 x 200 mm
            `,
            relevance: 0.8
        }
    ];
};

// 2. Mock Gemini Service
const originalPlan = geminiService.generateJson;
geminiService.generateJson = async (prompt, schema, sys) => {
    try {
        console.log("[MockGemini] GenerateJSON called. Prompt len:", prompt.length);
        throw new Error("Force Mock for Testing"); // SKIP REAL CALL to ensure predictable exhaustive test
        // return await originalPlan.call(geminiService, prompt, schema, sys);
    } catch (e) {
        console.log("[MockGemini] Using Fallback Mock Response for:", prompt.slice(0, 50));
        // Fallback for Planner
        if (prompt.includes("Generate a comprehensive research plan")) {
            return {
                intent: "find_specifications",
                steps: [
                    { type: 'search', description: 'Find W1331X specifications', required_info: ['weight', 'dimensions'] }
                ],
                entities: [
                    { type: 'brand', value: 'HP' },
                    { type: 'model', value: 'W1331X' }
                ]
            } as any;
        }
        // Fallback for Extractor
        if (prompt.includes("Standardize and extract data")) {
            // Check if this is the 'bad store' content
            if (prompt.includes("1.2 kg")) {
                return {
                    packaging_mm: { length: 360, width: 100, height: 200 },
                    weight_g: 1200,
                    compatible_printers: ["HP Laser 408dn", "HP Laser 432fdn"],
                    yield_pages: 15000,
                    images: []
                } as any;
            }

            return {
                packaging_mm: { length: 362, width: 102, height: 198 },
                weight_g: 900,
                compatible_printers: ["HP Laser 408dn", "HP Laser 432fdn"],
                yield_pages: 15000,
                images: []
            } as any;
        }
        throw e;
    }
};


async function runVerification() {
    console.log("=== Starting Mocked Agentic Research Verification ===");

    // Test Query
    const query = "W1331X specs";

    try {
        const result = await deepResearchService.executeWorkflow(
            query,
            'exhaustive',
            'RU',
            true,
            (log) => console.log(`[Stream] ${log}`)
        );

        console.log("\n>>> Workflow Complete <<<");
        console.log("Status:", result.status);
        if (result.data) {
            console.log("Data:", JSON.stringify(result.data, null, 2));
        }

    } catch (e) {
        console.error("DeepResearch failed:", e);
    }
}

runVerification();
