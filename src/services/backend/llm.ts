
import { OpenRouter } from '@openrouter/sdk';
import { MODEL_CONFIGS, ModelProfile, DEFAULT_MODEL } from "../../config/models.js";

interface CompletionConfig {
    model?: string;
    profile?: ModelProfile; // Preferred way to select model
    messages: { role: 'system' | 'user' | 'assistant', content: string }[];
    jsonSchema?: any;
    maxTokens?: number;
    apiKeys?: Record<string, string>;
}

export class BackendLLMService {
    private static apiKey = process.env.OPENROUTER_API_KEY;

    static async complete(config: CompletionConfig) {
        const apiKey = config.apiKeys?.google || config.apiKeys?.openrouter || this.apiKey;
        if (!apiKey) throw new Error("Missing LLM API Key");

        const client = new OpenRouter({ apiKey });
        const { withRetry } = await import("../../lib/reliability.js");

        // Determine specific model to use
        let targetModel = config.model;
        if (!targetModel && config.profile) {
            targetModel = MODEL_CONFIGS[config.profile].candidates[0];
        }
        if (!targetModel) targetModel = DEFAULT_MODEL;

        console.log(`[LLM] Using model: ${targetModel} (Profile: ${config.profile || 'Custom'})`);

        // We can iterate through candidates if one fails
        const candidates = config.profile ? MODEL_CONFIGS[config.profile].candidates : [targetModel];

        let lastError: Error | null = null;

        for (const model of candidates) {
            try {
                return await withRetry(async () => {
                    try {
                        const result = await client.callModel({
                            model: model,
                            input: config.messages as any,
                            maxTokens: config.maxTokens,
                            response_format: config.jsonSchema ? { type: "json_object" } : undefined,
                            provider: {
                                order: ["DeepSeek", "Google", "OpenAI", "Anthropic"],
                                allow_fallbacks: false
                            }
                        } as any); // Type assertion for extra params if not strictly typed in beta SDK

                        const text = await result.getText();
                        if (!text) throw new Error("Empty response from LLM");
                        return text;

                    } catch (e: any) {
                        // Map 404 to explicit error for circuit breakers
                        if (e.message?.includes("404") || e.status === 404) {
                            throw new Error(`Model ${model} not found/unavailable (404)`);
                        }
                        if (e.message?.includes("402") || e.message?.includes("401") || e.status === 401) {
                            // Auth/Credits error, do not retry
                            throw new Error(`OpenRouter Auth/Credit Error: ${e.message}`);
                        }
                        throw e;
                    }

                }, {
                    maxRetries: 2,
                    baseDelayMs: 1000,
                    shouldRetry: (err) => !err.message.includes("Auth/Credit") && !err.message.includes("404")
                });

            } catch (err: any) {
                console.warn(`[LLM] Model ${model} failed`, err.message);
                lastError = err;
                // If it's an auth error, don't try other models
                if (err.message.includes("Auth/Credit")) throw err;
            }
        }

        throw lastError || new Error("All LLM candidates failed");
    }
}
