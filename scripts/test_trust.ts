
import { TrustEngine } from '../src/services/engine/TrustEngine.js';

async function run() {
    console.log("Testing Data Purity (Agent Hallucination vs Trusted Retailer)...");

    // Scenario: Agent returns 15000 (Hallucination from spam site)
    // NIX.ru returns 10200 (True fact)
    const conflictingClaims = [
        {
            value: "15000 pages",
            sourceType: "firecrawl_agent",
            sourceDomain: "random-spam-blog.com",
            confidence: 95
        },
        {
            value: "10200 pages",
            sourceType: "web",
            sourceDomain: "nix.ru",
            confidence: 90
        }
    ];

    try {
        const result = TrustEngine.resolveField(conflictingClaims as any);
        console.log("Conflict Resolution Result:", JSON.stringify(result, null, 2));

        // EXPECTATION: NIX (90 base score) vs Agent (75 smart score on unknown domain). NIX Wins.
        if (result?.value === "10200 pages" && result.method === 'official') { // trusted retailer treated as good
            console.log("✅ SUCCESS: Trusted Retailer (NIX) defeated Generic Agent Source.");
            // Note: TrustEngine treats NIX as high score, likely winning.
            // Let's see the score.
        } else if (result?.value === "10200 pages") {
            console.log("✅ SUCCESS: Retailer Won (Value match).");
        } else {
            console.error("❌ FAILURE: Agent override happened.");
        }

    } catch (e) {
        console.error("❌ Trust Engine Test Failed:", e);
    }
}

run();
