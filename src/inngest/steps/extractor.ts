
import { BackendLLMService } from "../../services/backend/llm";

export async function extractorStep(rawText: string, schemaKey: string) {
    // In a real implementation, we would pass the specific schema (StrictConsumableData)
    // For MVP, we extract a simplified subset

    const systemPrompt = `You are a Data Extractor. Extract strict JSON from the provided text.
  Schema Key: ${schemaKey}`;

    const response = await BackendLLMService.complete({
        model: "google/gemini-2.0-flash-001", // Smart enough
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawText }
        ],
        jsonSchema: true
    });

    return JSON.parse(response || "{}");
}
