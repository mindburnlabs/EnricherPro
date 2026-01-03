
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
        model: string = "openrouter/auto",
        apiKeys?: Record<string, string>,
        promptOverride?: string,
        onLog?: (msg: string) => void
    ): Promise<any> {

        const { useSettingsStore } = await import('../../stores/settingsStore.js');
        const state = useSettingsStore.getState();

        // 1. Get Base Instruction (User Configured or Default)
        const basePrompt = promptOverride || state.prompts.enrichment || `You are a Schema Architect for Data Extraction.`;

        // 2. Append Dynamic Context (Critical for operation)
        const systemPrompt = `${basePrompt}

        Target URL: ${url}
        Enrichment Goal: "${goal}"
        Language: ${language.toUpperCase()}
        `;

        try {
            const response = await BackendLLMService.complete({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Generate schema." }
                ],
                jsonSchema: FirecrawlSchemaSchema,
                routingStrategy: RoutingStrategy.SMART,
                apiKeys,
                onLog: onLog ? (_cat: string, msg: string) => onLog(msg) : undefined
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
