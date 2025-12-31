import { useState, useEffect, useCallback } from 'react';
import { StepStatus } from '../components/Research/RunProgress.js';
import { EnrichedItem } from '../types/domain.js';
import { getItems } from '../lib/api.js';

type ResearchStatus = 'idle' | 'running' | 'completed' | 'failed';

interface UseResearchStreamResult {
    steps: StepStatus[];
    items: EnrichedItem[];
    status: ResearchStatus;
    error: string | null;
    startStream: (jobId: string) => void;
    reset: () => void;
}

export interface ResearchLog {
    id: string;
    agent: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    timestamp: string;
}

export const useResearchStream = (): UseResearchStreamResult & { logs: ResearchLog[] } => {
    const [steps, setSteps] = useState<StepStatus[]>([]);
    const [items, setItems] = useState<EnrichedItem[]>([]);
    const [logs, setLogs] = useState<ResearchLog[]>([]); // New Log State
    const [status, setStatus] = useState<ResearchStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setSteps([]);
        setItems([]);
        setLogs([]);
        setStatus('idle');
        setError(null);
    }, []);

    const startStream = useCallback((jobId: string) => {
        reset();
        setStatus('running');

        // Initial step
        setSteps([{ id: 'init', label: 'Initializing Research...', status: 'running' }]);

        const eventSource = new EventSource(`/api/sse?jobId=${jobId}`);

        eventSource.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {

                    return;
                }

                if (data.type === 'logs') {
                    // Dedup and append
                    setLogs(prev => {
                        const newLogs = (data.logs as ResearchLog[]).filter(l => !prev.some(p => p.id === l.id));
                        if (newLogs.length === 0) return prev;
                        // Sort by timestamp
                        return [...prev, ...newLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    });
                }

                if (data.type === 'update') {
                    // Map backend step to UI step
                    // Backend steps: 'planning', 'searching', 'enrichment', 'gate_check'
                    const mapStepLabel = (s: string) => {
                        switch (s) {
                            case 'planning': return 'Planning Strategy (Agents active)';
                            case 'searching': return 'Gathering Intelligence (Firecrawl)';
                            case 'enrichment': return 'Synthesizing & Extracting';
                            case 'gate_check': return 'Quality Gatekeeper Validation';
                            default: return 'Processing...';
                        }
                    };

                    setSteps(prev => {
                        // Avoid duplicates if current step is same
                        if (prev.length > 0 && prev[prev.length - 1].id === data.step) {
                            return prev;
                        }

                        // Mark previous as done
                        const newSteps = prev.map(s => ({ ...s, status: 'completed' as const }));

                        // Add new
                        return [...newSteps, {
                            id: data.step,
                            label: mapStepLabel(data.step),
                            status: 'running'
                        }];
                    });
                }

                if (data.type === 'complete') {
                    setStatus('completed');
                    eventSource.close();

                    // Fetch final results
                    const itemsRes = await getItems(jobId);
                    if (itemsRes.success) {
                        setItems(itemsRes.items);
                    }

                    // Mark last step as done
                    setSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
                }

                if (data.type === 'error') {
                    console.error('SSE Error Message:', data.message);
                    setError(data.message);
                    setStatus('failed');
                    eventSource.close();
                }

            } catch (err) {
                console.error("Failed to parse SSE", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE Connection Error", err);
            // Don't close immediately, SSE tries to reconnect. 
            // But for this use-case, maybe we should close if persistent.
            // For now, let's assume it might recover or eventual timeout.
            if (eventSource.readyState === EventSource.CLOSED) {
                setError("Connection lost");
                setStatus('failed');
            }
        };

        return () => {
            eventSource.close();
        };
    }, [reset]);

    return { steps, items, logs, status, error, startStream, reset };
};
