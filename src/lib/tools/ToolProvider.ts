export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface ToolResult {
  output: string;
  isError: boolean;
  metadata?: Record<string, any>;
}

export interface ToolProvider {
  listTools(): Promise<ToolDefinition[]>;
  executeTool(name: string, args: Record<string, any>): Promise<ToolResult>;
}

// --- Registry Implementation (Native Tools) ---

type ToolHandler = (args: any) => Promise<ToolResult>;

export class NativeToolProvider implements ToolProvider {
  private tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }> = new Map();

  register(definition: ToolDefinition, handler: ToolHandler) {
    this.tools.set(definition.name, { definition, handler });
  }

  async listTools(): Promise<ToolDefinition[]> {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  async executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        output: `Tool ${name} not found`,
        isError: true,
      };
    }
    try {
      return await tool.handler(args);
    } catch (error: any) {
      return {
        output: `Error executing ${name}: ${error.message}`,
        isError: true,
      };
    }
  }
}
