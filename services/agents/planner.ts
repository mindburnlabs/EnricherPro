
import { geminiService } from '../geminiService';
import { AgentPlan } from './types';
import { v4 as uuidv4 } from 'uuid';

export class PlannerAgent {
    private static SYSTEM_PROMPT = `
You are the Planner Agent for a Cartridge Research System (Perplexity-like).
Your goal is to understand the user's input and create a structured research plan.

Input types:
1. Specific Model: "W1331X", "HP 17A"
2. Technical Query: "W1331X weight", "compatible printers for HP 106A"
3. Problem Solving: "why is my CF259X printing black spots"

You must output a JSON plan with:
- intent: 'lookup_specs' | 'compatibility_check' | 'troubleshooting' | 'market_research' | 'unknown'
- entities: Extracted product codes, brands, or concepts.
- steps: A list of actionable steps (Search, Extract). 

Available Task Types:
- search: { query: string } // Uses Firecrawl to search Google/Whitelist
- extract: { target: string, source_type: 'specs' | 'compatibility' | 'troubleshooting' } // Extraction instruction

Guidelines:
- For "Specs", always search NIX.ru or OEM sites first.
- For "Compatibility", search for "sovmestimost" (RU) or "compatibility" lists.
- For "Troubleshooting", search specific forums or support pages.
- If input is ambiguous, plan a "clarification" step (though strictly we want to try researching first).

Example Input: "W1331X"
Example Output:
{
  "intent": "lookup_specs",
  "analysis": "User provided a specific HP toner model W1331X (331X).",
  "entities": [{ "type": "model", "value": "W1331X" }, { "type": "brand", "value": "HP" }],
  "steps": [
    { "type": "search", "description": "Find logistics/specs on NIX.ru", "params": { "query": "site:nix.ru W1331X характеристики вес габариты" } },
    { "type": "search", "description": "Find compatible printers list", "params": { "query": "W1331X совместимые принтеры" } },
     { "type": "search", "description": "Find product images", "params": { "query": "W1331X packaging photo", "mode": "image" } }
  ]
}
`;

    public async plan(userQuery: string): Promise<AgentPlan> {
        const prompt = `User Query: "${userQuery}"\n\nGenerate the research plan.`;

        // We can define a schema for strict typing if we want, but letting the model freestyle a bit with JSON mode is often flexible enough for a start.
        // However, strict schema is better for 'perplexity' reliability. 
        // Let's use a schema.

        // Schema definition for Gemini
        const schema = {
            type: 'OBJECT',
            properties: {
                intent: { type: 'STRING', enum: ['lookup_specs', 'compatibility_check', 'troubleshooting', 'market_research', 'unknown'] },
                analysis: { type: 'STRING' },
                entities: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            type: { type: 'STRING' },
                            value: { type: 'STRING' }
                        }
                    }
                },
                steps: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            type: { type: 'STRING', enum: ['search', 'extract', 'verify', 'ask_user'] },
                            description: { type: 'STRING' },
                            params: { type: 'OBJECT', properties: { query: { type: 'STRING' }, mode: { type: 'STRING' } } }, // simplified params
                        }
                    }
                }
            },
            required: ['intent', 'steps']
        };

        try {
            const plan = await geminiService.generateJson<AgentPlan>(prompt, schema, PlannerAgent.SYSTEM_PROMPT);

            // Post-process to add IDs or defaults
            plan.steps = plan.steps.map(step => ({
                ...step,
                id: uuidv4(),
                status: 'pending'
            }));

            return plan;
        } catch (e) {
            console.error("Planner failed:", e);
            // Fallback plan
            return {
                intent: 'unknown',
                analysis: 'Failed to generate plan',
                entities: [],
                steps: [
                    { id: uuidv4(), type: 'search', description: 'Fallback Search', params: { query: userQuery }, status: 'pending' }
                ]
            };
        }
    }
}

export const plannerAgent = new PlannerAgent();
