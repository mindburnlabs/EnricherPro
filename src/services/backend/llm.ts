
import { MODEL_CONFIGS, ModelProfile, DEFAULT_MODEL } from "../../config/models.js";

interface OpenRouterPlugin {
    id: "web" | "response-healing" | "file-parser";
    max_results?: number; // for web
    search_prompt?: string; // for web
    engine?: "native" | "exa"; // for web
    pdf?: { engine: "mistral-ocr" | "pdf-text" | "native" }; // for file-parser
}

interface OpenRouterProviderConfig {
    order?: string[];
    sort?: "price" | "throughput" | "latency";
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: "deny" | "allow";
}

export enum RoutingStrategy {
    FAST = "fast",   // Uses :nitro or latency sort
    CHEAP = "cheap", // Uses price sort
    SMART = "smart", // Uses openrouter/auto
    BALANCED = "balanced" // Default
}

interface CompletionConfig {
    model?: string;
    profile?: ModelProfile;
    messages: { role: 'system' | 'user' | 'assistant', content: string | any[] }[]; // relaxed content type for multimodal
    jsonSchema?: any; // If present, uses 'json_schema' response format with strict mode
    maxTokens?: number;
    temperature?: number;
    apiKeys?: Record<string, string>;

    // SOTA Features
    plugins?: OpenRouterPlugin[]; // Web, Healing, PDF
    transforms?: ("middle-out")[]; // Compression
    models?: string[]; // Fallback models array
    provider?: OpenRouterProviderConfig; // Routing preferences
    routingStrategy?: RoutingStrategy;

    // Broadcast / Observability
    sessionId?: string;
    userId?: string;

    // Feature Flags
    useSota?: boolean; // Enable new features
}

export class BackendLLMService {
    private static apiKey = process.env.OPENROUTER_API_KEY;
    static async complete(config: CompletionConfig): Promise<string> {
        const apiKey = config.apiKeys?.openrouter || this.apiKey;
        if (!apiKey) throw new Error("Missing OpenRouter API Key");

        const { withRetry } = await import("../../lib/reliability.js");

        // 1. Resolve Primary Model
        // STRICT: Always use openrouter/auto (or configured override if passed explicitly, though we aim to pass 'openrouter/auto' generally)
        let targetModel = config.model || DEFAULT_MODEL;

        if (targetModel.endsWith(':free')) {
            // Keep specific logic for free models if needed later, currently handled in provider config below.
        }

        // SANITIZER: Catch phantom models that don't exist
        if (targetModel === 'openai/gpt-5.2') {
            console.warn("LLM Service: Detected invalid model 'openai/gpt-5.2'. Auto-correcting to 'openrouter/auto'.");
            targetModel = 'openrouter/auto';
        }

        // Routing Strategy Overrides - now irrelevant as profiles are all 'openrouter/auto'
        if (config.routingStrategy === RoutingStrategy.SMART && !targetModel) {
            targetModel = 'openrouter/auto';
        }

        // 2. Resolve Fallbacks
        // OpenRouter only allows a small list of models.
        // Since we are moving to 'openrouter/auto', we generally don't need extensive fallbacks.
        // We will LIMIT fallback models to max 2 items to avoid "models array must have 3 items or fewer" error
        // (Primary + 2 fallbacks = 3 total)
        let fallbackModels: string[] = [];
        if (config.models && config.models.length > 0) {
            fallbackModels = config.models.filter(m => m !== targetModel).slice(0, 2);
        } else if (config.profile) {
            // Profiles are now just ['openrouter/auto'], so this will likely be empty or same as target
            fallbackModels = MODEL_CONFIGS[config.profile].candidates.filter(m => m !== targetModel).slice(0, 2);
        }

        // 3. Construct Request Body
        // If useSota is true (or implied by presence of advanced fields), use advanced structure
        const body: any = {
            model: targetModel,
            messages: config.messages, // System prompt should be first for effective caching!
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            // Observability
            // OpenRouter supports mapping 'user' field in root.
            user: config.userId || 'anonymous_user',
        };

        // Fallbacks
        if (fallbackModels.length > 0) {
            body.models = [targetModel, ...fallbackModels];
        }

        // Session ID via HTTP Header usually, but some docs say body? 
        // Docs say: "Session ID: ... by including the session_id field ... You can also pass this via the x-session-id HTTP header."
        // We will do both for robustness.
        if (config.sessionId) {
            body.session_id = config.sessionId;
        }

        // Response Format & Structured Outputs
        if (config.jsonSchema) {
            body.response_format = {
                type: "json_schema",
                json_schema: {
                    name: "output_schema", // Generic name, required by OpenAI/OR
                    // strict: true, // REMOVED: Causes 400 on non-OpenAI models (e.g. Anthropic, Gemini via OpenRouter)
                    schema: config.jsonSchema
                }
            };
        }

        // Plugins & Transforms
        const plugins = config.plugins || [];
        const transforms = config.transforms || [];

        // Auto-Enable Response Healing if requesting JSON
        if (config.jsonSchema && !plugins.find(p => p.id === 'response-healing')) {
            plugins.push({ id: 'response-healing' });
        }

        // Auto-Enable Middle-Out if not specified (Standard SOTA behavior)
        if (!transforms.includes('middle-out')) {
            transforms.push('middle-out');
        }

        if (plugins.length > 0) body.plugins = plugins;
        if (transforms.length > 0) body.transforms = transforms;

        // Provider Routing
        // Apply routing strategy if no explicit provider config is present
        if (config.provider) {
            body.provider = config.provider;
        } else if (config.routingStrategy) {
            if (config.routingStrategy === RoutingStrategy.CHEAP) {
                body.provider = { sort: "price" };
            } else if (config.routingStrategy === RoutingStrategy.FAST) {
                body.provider = { sort: "latency" }; // If not using :nitro or fallback
            }
        }

        // Force allow data collection for free models if not explicitly set
        // Fixes: "No endpoints found matching your data policy (Free model publication)"
        if (targetModel.endsWith(':free')) {
            if (!body.provider) body.provider = {};
            if (!body.provider.data_collection) {
                body.provider.data_collection = "allow";
            }
        }

        // 4. Refactored Execution with Smart Fallback for 400s
        const executeFetch = async (currentBody: any) => {
            return await withRetry(async () => {
                try {
                    const headers: any = {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://enricher.pro", // Required by OpenRouter
                        "X-Title": "EnricherPro (Deep Research)"
                    };

                    if (config.sessionId) {
                        headers["X-Session-Id"] = config.sessionId;
                    }

                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: headers,
                        body: JSON.stringify(currentBody)
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        let errMsg = errText;
                        try {
                            const jsonErr = JSON.parse(errText);
                            errMsg = jsonErr.error?.message || errText;
                        } catch (e) { /* ignore */ }

                        // Map errors
                        if (response.status === 402 || response.status === 401) {
                            throw new Error(`OpenRouter Auth/Credit Error: ${errMsg}`);
                        }
                        if (response.status === 400) {
                            throw new Error(`OpenRouter Bad Request (400): ${errMsg}`);
                        }
                        throw new Error(`OpenRouter API Error (${response.status}): ${errMsg}`);
                    }

                    const data = await response.json();

                    // Handle non-choice response (should stay robust)
                    if (!data.choices || data.choices.length === 0) {
                        // Check if it's a processing error or similar
                        throw new Error("Empty response from LLM (No choices)");
                    }

                    const content = data.choices[0].message?.content;
                    if (!content) throw new Error("Empty content in LLM response");

                    return content;

                } catch (e: any) {
                    // Determine if retryable
                    // Auth/Credit errors - Stop immediately
                    if (e.message?.includes("Auth/Credit")) throw e;
                    if (e.message?.includes("(400)")) throw e; // Don't retry 400s in the inner loop, handle in outer
                    throw e;
                }
            }, {
                maxRetries: 2,
                baseDelayMs: 1000,
                shouldRetry: (err) => !err.message.includes("Auth/Credit") && !err.message.includes("(400)")
            });
        };

        try {
            return await executeFetch(body);
        } catch (e: any) {
            // SOTA Fallback: If 400 Error AND we used json_schema, try again without it.
            // Many providers (Anthropic, Gemini via OR) fail hard on 'json_schema' even with strict:false
            if (e.message?.includes("(400)") && body.response_format?.type === 'json_schema') {
                console.warn("LLM Service: 400 Error with json_schema. Retrying with RAW prompt fallback...", e.message);
                delete body.response_format;

                // Append instruction to system prompt to ensure JSON
                if (body.messages[0].role === 'system') {
                    body.messages[0].content += "\n\nCRITICAL: Return VALID JSON only. No markdown formatting. No preamble.";
                }

                return await executeFetch(body);
            }
            throw e;
        }
    }
}

