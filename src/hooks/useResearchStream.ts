import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StepStatus, EnrichedItem, ConsumableData } from '../types/domain.js';
import { getItems } from '../lib/api.js';

type ResearchStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface ResearchLog {
  id: string;
  jobId: string;
  agent: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
}

// Unified State Result
interface UseResearchStreamResult {
  // Pipeline State
  status: ResearchStatus;
  steps: StepStatus[];
  progress: number;
  error: string | null;

  // Data State
  activeSku: EnrichedItem | null; // The "Real-Time Product Card" data
  items: EnrichedItem[]; // Final Results

  // Observability
  logs: ResearchLog[];

  // Actions
  startStream: (jobId: string) => void;
  reset: () => void;
}

import { useTranslation } from 'react-i18next';

export const useResearchStream = (): UseResearchStreamResult => {
  const { t } = useTranslation('common');

  const [status, setStatus] = useState<ResearchStatus>('idle');
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeSku, setActiveSku] = useState<EnrichedItem | null>(null);
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [logs, setLogs] = useState<ResearchLog[]>([]);

  const logsRef = useRef<ResearchLog[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setSteps([]);
    setProgress(0);
    setError(null);
    setActiveSku(null);
    setLogs([]);
    logsRef.current = [];
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startStream = useCallback(
    (jobId: string) => {
      reset();
      setStatus('running');

      // Initial "Planning" step
      setSteps([
        {
          id: 'init',
          label: t('progress.steps.init', 'Initializing...'),
          status: 'running',
          logStartIndex: 0,
        },
      ]);

      const eventSource = new EventSource(`/api/sse?jobId=${jobId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connected');
      };

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              // Connection confirmed
              break;

            case 'logs':
              // Append new logs
              if (Array.isArray(data.logs)) {
                setLogs((prev) => {
                  const newLogs = (data.logs as ResearchLog[]).filter(
                    (l) => !prev.some((p) => p.id === l.id),
                  );
                  if (newLogs.length === 0) return prev;

                  const updated = [...prev, ...newLogs].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                  );
                  logsRef.current = updated;
                  return updated;
                });
              }
              break;

            case 'update':
              // Job Status / Step Update
              if (data.status) {
                if (data.status === 'failed') setStatus('failed');
                // We don't auto-set completed here, we wait for 'complete' event usually,
                // or handle it if status is 'needs_review' etc.
              }
              if (data.progress) setProgress(data.progress);

              // Map step to UI
              if (data.step) {
                setSteps((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.id === data.step) return prev;

                  const currentLogCount = logsRef.current.length;

                  // Close previous
                  const newSteps = prev.map((s) =>
                    s.status === 'running'
                      ? { ...s, status: 'completed' as const, logEndIndex: currentLogCount }
                      : s,
                  );

                  // Add new
                  const stepLabel = t(`progress.steps.${data.step}`, data.step);
                  newSteps.push({
                    id: data.step,
                    label: stepLabel,
                    status: 'running',
                    logStartIndex: currentLogCount,
                  });
                  return newSteps;
                });
              }
              break;

            case 'data_update':
              // Real-time Product Card update
              if (data.data) {
                setActiveSku(data.data as EnrichedItem);
              }
              break;

            case 'complete':
              setStatus(data.status === 'failed' ? 'failed' : 'completed');
              eventSource.close();

              // Create final step completion
              setSteps((prev) =>
                prev.map((s) =>
                  s.status === 'running'
                    ? { ...s, status: 'completed' as const, logEndIndex: logsRef.current.length }
                    : s,
                ),
              );
              break;

            case 'error':
              console.error('[SSE] Error:', data.message);
              setError(data.message);
              setStatus('failed');
              eventSource.close();
              break;
          }
        } catch (err) {
          console.error('[SSE] Parse Error:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[SSE] Connection Error', err);
        if (eventSource.readyState === EventSource.CLOSED) {
          // If it closed unexpectedly
          setError('Connection lost');
          setStatus('failed');
        }
      };

      return () => {
        eventSource.close();
      };
    },
    [reset, t],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    status,
    steps,
    progress,
    error,
    activeSku,
    items, // Exposed for final results
    logs,
    startStream,
    reset,
  };
};
