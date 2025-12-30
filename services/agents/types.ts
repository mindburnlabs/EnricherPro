
export interface AgentTask {
    id: string;
    type: 'search' | 'extract' | 'verify' | 'ask_user';
    description: string;
    params: any;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
}

export interface AgentPlan {
    intent: string;
    analysis: string;
    entities: {
        type: string;
        value: string;
        [key: string]: any;
    }[];
    steps: AgentTask[];
}
