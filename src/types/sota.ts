
// Result Pattern for Robust Error Handling
export type Result<T, E = Error> =
    | { success: true; data: T }
    | { success: false; error: E };

export const Ok = <T>(data: T): Result<T, never> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

// Standardized Agent Interface
export interface Agent<Input, Output> {
    name: string;
    description: string;
    execute(input: Input, context?: any): Promise<Result<Output>>;
}

// Circuit Breaker Config
export interface ResilienceConfig {
    maxRetries: number;
    timeoutMs: number;
    fallback?: any;
}

export type ProcessingStage =
    | 'INITIALIZATION'
    | 'NORMALIZATION'
    | 'DISCOVERY'
    | 'DEEP_RESEARCH'
    | 'SYNTHESIS'
    | 'AUDIT';

// Workflow Context for passing state between agents
export interface WorkflowContext {
    jobId: string;
    stage: ProcessingStage;
    history: Array<{
        agent: string;
        timestamp: number;
        status: 'success' | 'failure';
        durationMs: number;
    }>;
    sharedMemory: Map<string, any>;
}
