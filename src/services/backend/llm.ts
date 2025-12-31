
// import { GoogleGenerativeAI } from "@google/genai"; // If using Gemini direct
// OR we use fetch for OpenRouter to keep it simple and dependency-light


export class BackendLLMService {
    private static apiKey = process.env.OPENROUTER_API_KEY;

    static async complete(config: {
        model: string,
        messages: { role: 'system' | 'user' | 'assistant', content: string }[],
        jsonSchema?: any,
        apiKeys?: Record<string, string>
    }) {
        const apiKey = config.apiKeys?.google || config.apiKeys?.openrouter || this.apiKey;
        if (!apiKey) throw new Error("Missing LLM API Key");

        const { withRetry } = await import("../../lib/reliability.js");

        return withRetry(async () => {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`, // use resolved key
                    "Content-Type": "application/json",
                    // "HTTP-Referer": "" // site url
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: config.messages,
                    response_format: config.jsonSchema ? { type: "json_object" } : undefined
                })
            });

            if (!response.ok) {
                // don't retry 401/403/400
                if ([400, 401, 403].includes(response.status)) {
                    const err = await response.text();
                    throw new Error(`OpenRouter Call Failed (${response.status}): ${err}`); // Non-retryable
                }
                // 429, 5xx will throw and trigger retry
                const err = await response.text();
                throw new Error(`OpenRouter Call Failed: ${err}`);
            }

            const json = await response.json();
            return json.choices[0].message.content;
        }, {
            maxRetries: 3,
            baseDelayMs: 1000,
            shouldRetry: (err) => !err.message.includes("(401)") && !err.message.includes("(403)") && !err.message.includes("(400)")
        });
    }
}
