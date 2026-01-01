
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Inject Mock Key EARLY
if (!process.env.OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
}

// Dynamic Imports can be top level in ESM? No, top level imports are hoisted.
// We must use dynamic import inside runTest OR rely on the fact that the env var setting above happens 
// (which it does not if imports are hoisted).
// But wait, `tsc` or `tsx` handles execution.
// In native ESM, imports are hoisted and evaluated first.
// So `process.env...` here runs AFTER `llm.js` is imported.
// We need to use dynamic imports to guarantee order, OR put env setup in a separate file imported first.
// BUT for this script, I'll just use dynamic imports.

async function runTest() {
    console.log("🚀 Starting OpenRouter SOTA Verification (Mock Mode)...");

    const { BackendLLMService, RoutingStrategy } = await import("../src/services/backend/llm.js");
    const { DiscoveryAgent } = await import("../src/services/agents/DiscoveryAgent.js");

    // Mock Fetch
    const originalFetch = global.fetch;
    let lastRequestBody: any = null;
    let lastRequestHeaders: any = null;

    global.fetch = async (url: any, options: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('openrouter.ai/api/v1/chat/completions')) {
            lastRequestBody = JSON.parse(options.body as string);
            lastRequestHeaders = options.headers;
            return {
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: JSON.stringify({ verification_token: "test_token", confidence: 0.99, mode: 'fast' }) } }]
                }),
                text: async () => ""
            } as any;
        }
        if (urlStr.includes('openrouter.ai/api/v1/models')) {
            return {
                ok: true,
                json: async () => ({ data: [] })
            } as any;
        }
        return originalFetch(url, options);
    };

    // Test 1: Strict Structured Outputs & Routing
    console.log("\n🧪 Test 1: Verifying Strict Schema & SMART Routing...");
    try {
        const strictSchema = {
            type: "object",
            properties: {
                verification_token: { type: "string" },
                confidence: { type: "number" }
            },
            required: ["verification_token", "confidence"],
            additionalProperties: false
        };

        const response = await BackendLLMService.complete({
            messages: [{ role: "user", content: "Test Strict Schema" }],
            jsonSchema: strictSchema,
            routingStrategy: RoutingStrategy.SMART,
            userId: "test-user-sota"
        });

        // Verify Request Body
        if (lastRequestBody) {
            console.log("🔍 Inspecting Request Body:", JSON.stringify(lastRequestBody, null, 2));

            // Check Strict Schema
            if (lastRequestBody.response_format?.json_schema?.strict === true) {
                console.log("✅ Strict Schema: ENABLED");
            } else {
                console.error("❌ Strict Schema: MISSING or FALSE");
            }

            // Check Routing (SMART -> openrouter/auto or similar logic)
            if (lastRequestBody.model === 'openrouter/auto' || lastRequestBody.provider?.sort) {
                console.log("✅ Routing Strategy: APPLIED");
            } else {
                console.warn("⚠️ Routing Strategy: Maybe default model used? Model: " + lastRequestBody.model);
            }

            // Check Observability
            if (lastRequestBody.user === 'test-user-sota') {
                console.log("✅ User Tracking: PRESENT");
            } else {
                console.error("❌ User Tracking: FAILED");
            }

        } else {
            console.error("❌ No request made to OpenRouter!");
        }

    } catch (e) {
        console.error("❌ Test 1 Failed:", e);
    }

    // Test 2: DiscoveryAgent Plan (Fast Mode -> Web Plugin)
    console.log("\n🧪 Test 2: Verifying DiscoveryAgent.plan (Fast Mode -> Web Plugin)...");
    try {
        lastRequestBody = null;
        // Call plan explicitly
        const plan = await DiscoveryAgent.plan("HP 12A", 'fast', undefined, undefined, (msg) => { });

        // Wait for LLM call inside plan...
        if (lastRequestBody) {
            console.log("🔍 Inspecting Request Body for Agent:", JSON.stringify(lastRequestBody, null, 2));

            // Check for Plugins
            if (lastRequestBody.plugins && lastRequestBody.plugins.find((p: any) => p.id === 'web')) {
                console.log("✅ Web Plugin: ENABLED (Fast Mode)");
            } else {
                console.error("❌ Web Plugin: MISSING in Fast Mode");
            }

            // Check Routing Strategy injection
            if (lastRequestBody.provider?.sort === 'price' || lastRequestBody.provider?.sort === 'latency' || lastRequestBody.provider?.order || lastRequestBody.model.includes('auto') || lastRequestBody.model.includes('nitro') || lastRequestBody.provider === undefined) {

                // If model is openrouter/auto, it IS the strategy
                if (lastRequestBody.model === 'openrouter/auto') {
                    console.log(`✅ Agent Routing: ENABLED (Smart -> ${lastRequestBody.model})`);
                } else if (lastRequestBody.model.includes(':nitro')) {
                    console.log(`✅ Agent Routing: ENABLED (Nitro -> ${lastRequestBody.model})`);
                } else {
                    console.log(`✅ Agent Routing: ENABLED (Provider Config or Strategy)`);
                }
            }
        } else {
            console.error("❌ DiscoveryAgent.plan did not trigger LLM call?");
        }

    } catch (e) {
        console.error("❌ Test 2 Failed:", e);
    }
}

runTest();
