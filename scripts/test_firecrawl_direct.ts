
import dotenv from 'dotenv';
import { BackendFirecrawlService } from '../src/services/backend/firecrawl.js';
import path from 'path';

// Try loading .env.local for local dev secrets
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Fallback to .env
dotenv.config();

async function run() {
    console.log("🔥 Testing Firecrawl Agent Direct Connection...");

    try {
        const prompt = "Find the current price of 'Sony WH-1000XM5' on amazon.com";
        const schema = {
            type: "object",
            properties: {
                price: { type: "number" },
                currency: { type: "string" }
            }
        };

        console.log(`Sending Agent Request: "${prompt}"`);
        const result = await BackendFirecrawlService.agent(prompt, {
            schema,
            timeout: 60000
        });

        console.log("✅ Agent Success!");
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("❌ Agent Failed:", e);
        // print full error object
        console.dir(e, { depth: null });
    }
}

run();
