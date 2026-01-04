export interface AgentUsageSummary {
  agent: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
}

export interface ModelUsageSummary {
  model: string;
  provider: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface JobUsageSummary {
  jobId: string;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  agentBreakdown: AgentUsageSummary[];
}
