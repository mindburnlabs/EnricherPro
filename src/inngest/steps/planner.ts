
import { BackendLLMService } from "../../services/backend/llm";

export async function plannerStep(inputRaw: string) {
    const systemPrompt = `You are a Research Planner for printer consumables. 
  Your goal is to identify what this input represents and how to research it.
  
  Input: "${inputRaw}"
  
  Return a JSON object with:
  - type: "single_sku" | "list" | "unknown"
  - mpn: string (if found)
  - searchQueries: string[] (3 targeted queries for Firecrawl)
  `;

    const response = await BackendLLMService.complete({
        model: "google/gemini-flash-1.5", // Fast & Cheap
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: inputRaw }
        ],
        jsonSchema: true
    });

    return JSON.parse(response || "{}");
}
