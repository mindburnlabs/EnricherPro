
import dotenv from 'dotenv';
import { DiscoveryAgent } from '../src/services/agents/DiscoveryAgent.js';
import { TrustEngine } from '../src/services/engine/TrustEngine.js';

dotenv.config();

async function run() {
    console.log("🔍 Verifying 'Smart Agent' Capabilities...\n");

    // 1. Verify Deep Mode Language Enforcement
    console.log("1. Testing DiscoveryAgent Multi-Lingual Enforcement (DEEP Mode)...");
    try {
        const plan = await DiscoveryAgent.plan(
            "Canon C-EXV 42",
            'deep',
            undefined,
            undefined,
            undefined,
            undefined,
            'ru' // Target Russian market
        );

        const jsonPlan = JSON.stringify(plan, null, 2);
        // console.log("Plan:", jsonPlan);

        const allQueries = plan.strategies.flatMap(s => s.queries).join(' ');
        const hasChinese = /[\u4e00-\u9fa5]/.test(allQueries);
        const hasRussian = /[а-яА-Я]/.test(allQueries);

        if (hasChinese) console.log("✅ Chinese OEM Queries Found (Global Sourcing Verified)");
        else console.error("❌ Chinese Queries MISSING");

        if (hasRussian) console.log("✅ Russian Retail Queries Found (Local Availability Verified)");
        else console.error("❌ Russian Queries MISSING");

    } catch (e) {
        console.error("❌ Planning Failed:", e);
    }

    // 2. Verify Trust Engine Purity (Agent vs NIX)
    console.log("\n2. Testing Data Purity (Agent Hallucination vs Trusted Retailer)...");

    const conflictingClaims = [
        {
            value: "15000 pages",
            sourceType: "firecrawl_agent", // Extracted by AI
            sourceDomain: "random-spam-blog.com", // Unknown domain
            confidence: 95
        },
        {
            value: "10200 pages",
            sourceType: "web",
            sourceDomain: "nix.ru", // Trusted Retailer
            confidence: 90
        }
    ];

    try {
        const result = TrustEngine.resolveField(conflictingClaims as any);
        console.log("Conflict Resolution Result:", JSON.stringify(result, null, 2));

        if (result?.value === "10200 pages") {
            console.log("✅ SUCCESS: Trusted Retailer (NIX) defeated Generic Agent Source.");
        } else {
            console.error("❌ FAILURE: Spam/Unknown Agent source overrode Trusted Retailer.");
        }

    } catch (e) {
        console.error("❌ Trust Engine Test Failed:", e);
    }
}

run();
