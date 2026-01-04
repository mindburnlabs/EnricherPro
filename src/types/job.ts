export type JobStatus = 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'needs_review' 
  | 'blocked' 
  | 'ready_to_publish';

export type FieldStatus = 'pending' | 'verified' | 'conflict' | 'locked';

export interface SKUField {
  value: string | number | null;
  status: FieldStatus;
  confidence?: number;
  source?: string;
  lockedBy?: string;
  lockedAt?: Date;
}

export interface SKUData {
  id: string;
  mpn: SKUField;
  brand: SKUField;
  yield: SKUField;
  dimensions: SKUField;
  weight: SKUField;
  heroImage?: {
    url: string;
    qcStatus: 'pending' | 'approved' | 'rejected';
  };
  customFields?: Record<string, SKUField>;
}

export interface Job {
  id: string;
  inputString: string;
  mpn: string;
  brand: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  cost: number;
  duration: number;
  tokenUsage: number;
  skuData?: SKUData;
}

export interface AgentMessage {
  id: string;
  type: 'plan' | 'activity' | 'decision' | 'blocker' | 'result';
  content: string;
  timestamp: Date;
  agentName?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface Evidence {
  id: string;
  fieldName: string;
  value: string;
  sourceUrl: string;
  sourceType: 'official' | 'marketplace' | 'forum' | 'datasheet';
  snippet: string;
  confidence: number;
  verified: boolean;
  fetchedAt: Date;
  hash?: string;
}

export interface ConflictData {
  fieldName: string;
  claims: {
    value: string;
    sourceUrl: string;
    confidence: number;
    sourceType: string;
  }[];
}

export interface BudgetData {
  tokenUsage: number;
  tokenLimit: number;
  estimatedCost: number;
  costLimit: number;
  apiCalls: number;
  apiCallLimit: number;
}
