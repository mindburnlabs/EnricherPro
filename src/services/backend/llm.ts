
import "../../lib/suppress-warnings.js";
import { MODEL_CONFIGS, ModelProfile, DEFAULT_MODEL } from "../../config/models.js";
import { ObservabilityService } from './ObservabilityService.js';


const FREE_FALLBACK_CHAIN = [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "allenai/olmo-3.1-32b-think:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "microsoft/phi-4:free",
    "google/gemini-2.5-flash-lite-preview-09-2025"
];

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
    BALANCED = "balanced", // Default
    EXTRACTION = "extraction" // For data extraction
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

    // Observability Context (for tracking)
    agentContext?: {
        jobId?: string;
        tenantId?: string;
        agent: string;
        operation?: string;
    };

    // UI Feedback
    onLog?: (category: string, msg: string) => void;
}

export class BackendLLMService {
    // private static apiKey = process.env.OPENROUTER_API_KEY; // DEPRECATED: Strict UI Control Enforced
    static async complete(config: CompletionConfig): Promise<string> {
        let apiKey = config.apiKeys?.openrouter;

        // Strict UI Control:
        // We do NOT fall back to process.env.
        // If the key is missing from config, we FAIL.
        if (!apiKey) {
            // DEVELOPER EXPERIENCE SOTA: Allow env fallback in DEV mode only
            // @ts-ignore
            if (process.env.NODE_ENV === 'development' && process.env.OPENROUTER_API_KEY) {
                console.warn("⚠️ Using OPENROUTER_API_KEY from env (Dev Mode Fallback). UI Settings preferred for Production.");
                // @ts-ignore
                apiKey = process.env.OPENROUTER_API_KEY;
            } else {
                 throw new Error("Missing OpenRouter API Key. Please configure it in the UI Settings.");
            }
        }

        const { withRetry } = await import("../../lib/reliability.js");

        // 1. Resolve Primary Model
        let targetModel = config.model;

        // User Requirement: "Always use smart free models unless user selects specific models"
        // If model is undefined or 'openrouter/auto', we resolve to the Profile's top candidate (which is Smart Free).
        if ((!targetModel || targetModel === 'openrouter/auto') && config.profile) {
            const profileName = config.profile;
            // Typecast to safely access dynamic property on readonly const
            const candidates: readonly string[] = (MODEL_CONFIGS as any)[profileName]?.candidates || [];

            if (candidates.length > 0) {
                // SOTA: Prioritize FREE models if they exist in the candidate list
                // The generator *should* sort them first, but we enforce it here to be safe.
                const bestFree = candidates.find((m: string) => m.endsWith(':free'));
                targetModel = bestFree || candidates[0];
            }
        }

        // Final fallback if no profile or empty candidates
        // STRICT POLICY: If we still don't have a model, or if we fell back to default,
        // we MUST ensure it's a free model unless the user explicitly requested otherwise.
        if (!targetModel || targetModel === 'openrouter/auto') {
            // Hardcoded safe fallback for "Free Only" policy
            targetModel = 'google/gemini-2.0-flash-exp:free';
        } else {
            targetModel = targetModel || DEFAULT_MODEL;
        }

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
        // FIX: openrouter/auto often routes to models incompatible with 'json_schema' (causing 400s).
        // If targeting auto, we proactively DOWNGRADE to Raw Mode (System Prompt instruction) to avoid the error roundtrip.
        if (config.jsonSchema) {
            const isAuto = targetModel === 'openrouter/auto';

            if (!isAuto) {
                // For specific models (gpt-4o, etc), we use strict native schema
                body.response_format = {
                    type: "json_schema",
                    json_schema: {
                        name: "output_schema",
                        schema: config.jsonSchema
                    }
                };
            } else {
                // For Auto: Append strict JSON instruction to System Prompt if not already there
                const schemaString = JSON.stringify(config.jsonSchema, null, 2);
                const instruction = `\n\nCRITICAL: You MUST return strictly valid JSON matching this schema:\n${schemaString}\n\nNO MARKDOWN. NO PREAMBLE. JUST JSON.`;

                // Append to the last system message, or first message if no system
                const sysIdx = body.messages.findIndex((m: any) => m.role === 'system');
                if (sysIdx >= 0) {
                    body.messages[sysIdx].content += instruction;
                } else {
                    body.messages.unshift({ role: "system", content: instruction });
                }
            }
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
            const startTime = Date.now();
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

                    const controller = new AbortController();
                    // 120s timeout to prevent Vercel (300s) timeout from killing the entire process
                    // This allows us to fail fast and switch models
                    const timeoutId = setTimeout(() => controller.abort(), 120000);

                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: headers,
                        body: JSON.stringify(currentBody),
                        signal: controller.signal
                    }).finally(() => clearTimeout(timeoutId));

                    if (!response.ok) {
                        const errText = await response.text();
                        // QUIET FALLBACK: If 429 and using free model, just warn (because we have fallback logic)
                        if (response.status === 429 && targetModel.endsWith(':free')) {
                            console.warn(`LLM Service: Rate Limit (429) on ${targetModel}. Error Body:`, errText);
                        } else {
                            console.error(`LLM Service Error Body:`, errText);
                        }

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

                    // OBSERVABILITY: Track successful request
                    if (config.agentContext) {
                        const latencyMs = Date.now() - startTime;
                        const usage = data.usage;
                        ObservabilityService.trackUsage(config.agentContext, {
                            model: data.model || currentBody.model || targetModel,
                            promptTokens: usage?.prompt_tokens,
                            completionTokens: usage?.completion_tokens,
                            totalTokens: usage?.total_tokens,
                            latencyMs,
                            statusCode: 200,
                        }).catch(() => { }); // Fire and forget
                    }

                    return content;

                } catch (e: any) {
                    // OBSERVABILITY: Track failed request
                    if (config.agentContext) {
                        const latencyMs = Date.now() - startTime;
                        ObservabilityService.trackUsage(config.agentContext, {
                            model: currentBody.model || targetModel,
                            latencyMs,
                            isError: e.message?.substring(0, 100),
                        }).catch(() => { }); // Fire and forget
                    }

                    // Determine if retryable
                    // Auth/Credit errors - Stop immediately
                    if (e.message?.includes("Auth/Credit")) throw e;
                    if (e.message?.includes("(400)")) throw e; // Don't retry 400s in the inner loop, handle in outer
                    throw e;
                }
            }, {
                maxRetries: 2,
                baseDelayMs: 1000,
                shouldRetry: (err) => {
                    // 1. Don't retry 400s (Bad Request) - handled in outer loop logic
                    if (err.message.includes("(400)")) return false;

                    // 2. Auth/Credit (402) - Never retry in inner loop, bubble to outer switch
                    if (err.message.includes("Auth/Credit")) return false;

                    // 3. Rate Limit (429)
                    if (err.message.includes("Rate Limit") || err.message.includes("(429)")) {
                        // STRICT USER REQUEST: Only pause/retry if user EXPLICITLY selected a paid model.
                        // If we are on a Free model (or Auto which defaults to free), we FAIL FAST to switch models.
                        const isFreeOrAuto = targetModel.endsWith(':free') || targetModel === 'openrouter/auto';
                        if (isFreeOrAuto) {
                            return false; // Fail fast -> Trigger Switch
                        }
                        // If paid model, return true -> triggers standard 'reliability.ts' pause logic (60s etc)
                        return true;
                    }

                    // 4. Timeout (AbortError) - Fail fast to switch models
                    if (err.name === 'AbortError' || err.message.includes("aborted")) return false;

                    // Default: Retry 5xx, network errors, etc.
                    return true;
                }
            });
        };

        try {
            return await executeFetch(body);
        } catch (e: any) {
            // SOTA Fallback: If 402 (Credits) OR 429 (Rate Limit) OR Timeout, switch to NEXT free model.
            if (e.message?.includes("Auth/Credit") || e.message?.includes("Rate Limit") || e.message?.includes("(429)") || e.name === 'AbortError' || e.message?.includes("aborted")) {
                const isRateLimit = e.message?.includes("Rate Limit") || e.message?.includes("(429)");
                const isTimeout = e.name === 'AbortError' || e.message?.includes("aborted");
                
                let limitMsg = '402 Insufficient Credits';
                if (isRateLimit) limitMsg = '429 Rate Limit';
                if (isTimeout) limitMsg = 'Timeout (120s)';

                console.warn(`LLM Service: ${limitMsg}. Switching to next Dynamic FREE fallback.`);
                if (config.onLog) config.onLog(`system`, `⚠️ LLM Service: ${limitMsg}. Initiating failover...`);

                // 1. Resolve Best Free Candidate from Config
                const profileName = config.profile || 'fast_cheap';
                // Typecast to avoid TS 'never' inference on read-only const
                let candidates: string[] = [...((MODEL_CONFIGS as any)[profileName]?.candidates || [])];
                
                // Merge with global fallback chain to ensure we have options
                candidates = [...new Set([...candidates, ...FREE_FALLBACK_CHAIN])];

                // Logic: Find current model in candidates, pick NEXT one that is free.
                // If current model not in candidates (e.g. was default/auto), pick FIRST free.
                let nextModel = '';

                // Current attempted model is in body.model, or targetModel
                const currentModelId = body.model || targetModel;
                const currentIndex = candidates.indexOf(currentModelId);

                if (currentIndex >= 0) {
                    // Start searching from next index
                    const nextCandidate = candidates.slice(currentIndex + 1).find((m: string) => m.endsWith(':free'));
                    if (nextCandidate) nextModel = nextCandidate;
                }

                // If no next model found (end of list, or current wasn't in list), try finding FIRST free (if we haven't tried it yet)
                // BUT we must avoid infinite loops if we are just starting.
                // If current wasn't in list, we pick the first one.
                if (!nextModel && currentIndex === -1) {
                    const firstFree = candidates.find((m: string) => m.endsWith(':free'));
                    if (firstFree) nextModel = firstFree;
                }

                // If still no model, and it was 429, we might want to try a hardcoded backup or just fail.
                // For now, if we can't find a new model, we re-throw (letting standard retry/pause happen).
                if (nextModel && nextModel !== currentModelId) {
                    console.warn(`LLM Service: Switching attempt from ${currentModelId} to ${nextModel}`);
                    if (config.onLog) config.onLog(`system`, `♻️ Switching model to: ${nextModel}`);
                    body.model = nextModel;

                    // Ensure Data Collection is Allow (Required for free models)
                    if (!body.provider) body.provider = {};
                    body.provider.data_collection = "allow";

                    // Retry execution with new body
                    return await executeFetch(body);
                }

                console.warn("LLM Service: No alternative free models found in profile. Propagating error.");
                throw e;
            }

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

