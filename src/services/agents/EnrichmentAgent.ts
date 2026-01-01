
import { BackendLLMService, RoutingStrategy } from "../backend/llm.js";
import { FirecrawlSchemaSchema } from "../../schemas/agent_schemas.js";

export class EnrichmentAgent {
    /**
     * Generates a tailored JSON Schema for a specific Enrichment Goal on a specific URL.
     * This allows the "Global Analyst" to say "Get me the weight from this page" and this agent
     * constructs the perfect Firecrawl extract schema for it.
     */
    static async generateSchema(
        goal: string,
        url: string,
        language: string = 'en',
        model: string = "google/gemini-2.0-flash-exp:free"
    ): Promise<any> {

        const systemPrompt = `You are a Schema Architect for Data Extraction.
        Your goal is to create a JSON Schema (draft-07) that perfectly captures the "Enrichment Goal" from a specific URL.

        Target URL: ${url}
        Enrichment Goal: "${goal}"
        Language: ${language.toUpperCase()}

        Rules:
        1. Return ONLY the JSON Schema object.
        2. Use precise field names (snake_case).
        3. Include descriptions for fields to guide the extraction model.
        4. If the goal implies multiple items, use an array structure.
        5. Ensure types are correct (number for weight, string for text).
        `;

        try {
            const response = await BackendLLMService.complete({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Generate schema." }
                ],
                jsonSchema: FirecrawlSchemaSchema,
                routingStrategy: RoutingStrategy.SMART
            });

            return JSON.parse(response || "{}");
        } catch (error) {
            console.error("EnrichmentAgent Schema Generation Failed:", error);
            // Fallback generic schema
            return {
                type: "object",
                properties: {
                    extracted_data: { type: "string", description: "The content relevant to the goal." }
                }
            };
        }
    }
}
