import { StepStatus, EnrichedItem } from '../../types/domain.js';
import { ResearchLog } from '../../hooks/useResearchStream.js';

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;

  // Assistant specific state
  jobId?: string;
  status?: 'running' | 'completed' | 'failed';
  steps?: StepStatus[];
  items?: EnrichedItem[];
  logs?: ResearchLog[];
  error?: string | null;
}
