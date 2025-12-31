
import { MODEL_CONFIGS, ModelProfile, DEFAULT_MODEL } from "../../config/models.js";

interface CompletionConfig {
    model?: string;
    profile?: ModelProfile; // Preferred way to select model
    messages: { role: 'system' | 'user' | 'assistant', content: string }[];
    jsonSchema?: any;
    apiKeys?: Record<string, string>;
}

export class BackendLLMService {
    private static apiKey = process.env.OPENROUTER_API_KEY;

    static async complete(config: CompletionConfig) {
        const apiKey = config.apiKeys?.google || config.apiKeys?.openrouter || this.apiKey;
        if (!apiKey) throw new Error("Missing LLM API Key");

        const { withRetry } = await import("../../lib/reliability.js");

        // Determine specific model to use
        let targetModel = config.model;
        if (!targetModel && config.profile) {
            // Pick first candidate from profile
            // In future, we can add logic to rotate or pick based on cost/latency/availability
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
                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://enricher.pro",
                            "X-Title": "EnricherPro"
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: config.messages,
                            response_format: config.jsonSchema ? { type: "json_object" } : undefined,
                            // Provider routing preferences for OpenRouter
                            provider: {
                                order: ["DeepSeek", "Google", "OpenAI", "Anthropic"],
                                allow_fallbacks: false // We handle fallbacks manually via candidates loop if needed, but OpenRouter has its own too.
                            }
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        // 404 might mean model unavailable on OpenRouter -> Try next candidate
                        if (response.status === 404) {
                            throw new Error(`Model ${model} not found/unavailable (404)`);
                        }
                        if ([400, 401, 403].includes(response.status)) {
                            throw new Error(`OpenRouter Call Failed (${response.status}): ${errText}`); // Non-retryable
                        }
                        throw new Error(`OpenRouter Call Failed (${response.status}): ${errText}`);
                    }

                    const json = await response.json();
                    if (!json.choices || json.choices.length === 0) {
                        throw new Error("Empty response from LLM provider");
                    }
                    return json.choices[0].message.content;

                }, {
                    maxRetries: 2, // Retries per model
                    baseDelayMs: 1000,
                    shouldRetry: (err) => !err.message.includes("(401)") && !err.message.includes("(403)") && !err.message.includes("(400)") && !err.message.includes("(404)")
                });

            } catch (err: any) {
                console.warn(`[LLM] Model ${model} failed`, err.message);
                lastError = err;
                // If it's an auth error, don't try other models, key is bad
                if (err.message.includes("(401)") || err.message.includes("(403)")) throw err;
                // Otherwise continue to next candidate
            }
        }

        throw lastError || new Error("All LLM candidates failed");
    }
}
