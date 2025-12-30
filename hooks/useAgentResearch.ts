
import { useState, useCallback } from 'react';
import { orchestrationService } from '../services/orchestrationService';
import { EnrichedItem } from '../types/domain';

export type ResearchStep = {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed';
    details?: string;
    type?: 'plan' | 'search' | 'extract' | 'verify';
    depth?: number;
};

export const useAgentResearch = () => {
    const [result, setResult] = useState<EnrichedItem | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [steps, setSteps] = useState<ResearchStep[]>([]);
    const [error, setError] = useState<string | null>(null);

    const research = useCallback(async (query: string, mode: 'fast' | 'standard' | 'exhaustive' = 'standard') => {
        setIsLoading(true);
        setResult(null);
        setError(null);
        setLogs([]);
        setSteps([]);

        try {
            const finalItem = await orchestrationService.processItem(
                query,
                (stage) => { /* Stage updates are less granular than logs */ },
                { engine: 'firecrawl', mode },
                (msg) => {
                    setLogs(prev => [...prev, msg]);

                    // Advanced Log Parsing for Visualization
                    if (msg.startsWith('[Agent] Planning')) {
                        setSteps(prev => [...prev, { id: 'plan', label: 'Generating Research Plan', status: 'running', type: 'plan', depth: 0 }]);
                    }
                    else if (msg.startsWith('[Agent] Intent:')) {
                        setSteps(prev => prev.map(s => s.id === 'plan' ? { ...s, status: 'completed', details: msg.replace('[Agent] Intent: ', '') } : s));
                    }
                    else if (msg.includes('Deep Mode: Starting search pass')) {
                        const passNum = msg.match(/pass (\d+)/)?.[1] || '?';
                        setSteps(prev => [...prev, { id: `pass-${passNum}`, label: `Deep Search Pass ${passNum}`, status: 'running', type: 'search', depth: 0 }]);
                    }
                    else if (msg.startsWith('[Agent] executing step:')) {
                        const stepName = msg.split(': ')[1];
                        setSteps(prev => [...prev, { id: `exec-${Date.now()}`, label: stepName, status: 'running', type: 'search', depth: 1 }]);
                    }
                    else if (msg.startsWith('[Agent] Found')) {
                        const count = msg.match(/Found (\d+)/)?.[1] || '0';
                        setSteps(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.status === 'running' && last.type === 'search') {
                                return prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'completed', details: `${count} sources found` } : s);
                            }
                            return prev;
                        });
                    }
                    else if (msg.startsWith('[Agent] Extracting data')) {
                        setSteps(prev => [...prev, { id: `extract-${Date.now()}`, label: 'Structuring Knowledge', status: 'running', type: 'extract', depth: 1 }]);
                    }
                    else if (msg.startsWith('[Agent] Extracted data')) {
                        setSteps(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.id.startsWith('extract')) {
                                return prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'completed' } : s);
                            }
                            return prev;
                        });
                    }
                    else if (msg.startsWith('[Agent] Verifying data')) {
                        setSteps(prev => [...prev, { id: 'verify', label: 'Verifying Facts', status: 'running', type: 'verify', depth: 0 }]);
                    }
                    else if (msg.startsWith('[Agent] Verification passed')) {
                        setSteps(prev => prev.map(s => s.id === 'verify' ? { ...s, status: 'completed', details: 'Passed' } : s));
                    }
                    else if (msg.startsWith('[Agent] Verification flagged')) {
                        setSteps(prev => prev.map(s => s.id === 'verify' ? { ...s, status: 'completed', details: 'Issues Found' } : s));
                    }
                }
            );
            setResult(finalItem);
        } catch (e: any) {
            setError(e.message || 'Research Failed');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { research, result, isLoading, logs, steps, error };
};
