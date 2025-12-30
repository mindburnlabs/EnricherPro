
// import { GoogleGenerativeAI } from "@google/genai"; // If using Gemini direct
// OR we use fetch for OpenRouter to keep it simple and dependency-light


export class BackendLLMService {
    private static apiKey = process.env.OPENROUTER_API_KEY;

    static async complete(config: {
        model: string,
        messages: { role: 'system' | 'user' | 'assistant', content: string }[],
        jsonSchema?: any
    }) {
        if (!this.apiKey) throw new Error("Missing OPENROUTER_API_KEY");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: config.model,
                messages: config.messages,
                response_format: config.jsonSchema ? { type: "json_object" } : undefined // Schema support varies by model
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenRouter Call Failed: ${err}`);
        }

        const json = await response.json();
        return json.choices[0].message.content;
    }
}
