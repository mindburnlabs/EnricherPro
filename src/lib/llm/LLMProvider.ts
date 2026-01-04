import { z } from 'zod';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface CompletionResult {
  content: string | null;
  toolCalls?: {
    name: string;
    arguments: Record<string, any>;
    id: string;
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
  };
}

export interface LLMProvider {
  complete(params: {
    model: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    tools?: Tool[];
    jsonMode?: boolean;
  }): Promise<CompletionResult>;

  estimateCost(tokens: number, model: string): number;
  supportsStreaming(): boolean;
  getProviderName(): string;
}

// --- Adapters ---

export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getProviderName(): string {
    return 'openrouter';
  }

  supportsStreaming(): boolean {
    return true;
  }

  estimateCost(tokens: number, model: string): number {
    // Basic estimation logic, can be refined with a pricing table map
    // E.g. $1 per million for cheap, $10 for expensive
    if (model.includes('gpt-4') || model.includes('claude-3-opus')) return (tokens / 1000000) * 10;
    if (model.includes('flash') || model.includes('haiku') || model.includes('mini'))
      return (tokens / 1000000) * 0.5;
    return (tokens / 1000000) * 1; // Default
  }

  async complete(params: {
    model: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    tools?: Tool[];
    jsonMode?: boolean;
  }): Promise<CompletionResult> {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://enricher-pro.com', // Required by OpenRouter
      'X-Title': 'EnricherPro',
    };

    const body: any = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
    };

    if (params.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const result: CompletionResult = {
        content: choice.message.content,
      };

      if (choice.message.tool_calls) {
        result.toolCalls = choice.message.tool_calls.map((tc: any) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
          id: tc.id,
        }));
      }

      if (data.usage) {
        result.usage = {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          costUsd: this.estimateCost(data.usage.total_tokens, params.model), // Should mostly rely on API if provided, but calculate fallback
        };
      }

      return result;
    } catch (error) {
      console.error('OpenRouter Completion Failed:', error);
      throw error;
    }
  }
}

// Placeholder for other providers (Anthropic, Google) if native SDK is preferred
// For now, OpenRouter covers most models including Claude and Gemini.
// We can implement specialized providers later if needed for specific features (e.g. caching).
