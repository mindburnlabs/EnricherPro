
import dotenv from 'dotenv';
import { BackendLLMService } from '../src/services/backend/llm.js';

dotenv.config();

const MODELS_TO_TEST = [
    "google/gemini-2.0-flash-lite-preview-02-05:free", // The one that failed first
    "google/gemini-2.0-pro-exp-02-05:free", // The one I tried second
    "google/gemini-2.0-flash-thinking-exp:free", // The one I tried third
    "google/gemini-2.0-flash-exp:free", // New candidate
    "google/gemini-flash-1.5:free", // Older stable
    "google/gemini-flash-1.5-8b",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-chat:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "microsoft/phi-4:free",
    "openrouter/auto:free" // The hail mary
];

async function run() {
    console.log("Testing Model Availability...");
    const apiKey = process.env.OPENROUTER_API_KEY;

    for (const model of MODELS_TO_TEST) {
        process.stdout.write(`Testing ${model}... `);
        try {
            const res = await BackendLLMService.complete({
                model: model,
                messages: [{ role: "user", content: "Hi" }],
                maxTokens: 5,
                apiKeys: apiKey ? { openRouter: apiKey } : undefined
            });
            console.log("✅ SUCCESS");
        } catch (e) {
            console.log(`❌ FAILED: ${(e as any).message?.split('\n')[0]}`);
        }
    }
}

run();
