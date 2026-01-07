import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { Job, JobStatus, SKUData, SKUField, AgentMessage, BudgetData } from '@/types/job';
import { AuditEntry } from '@/components/audit/AuditLogView';
import { ConsumableData, EnrichedItem, ValidationBlocker } from '@/types/domain';
import { getPublishingBlockers } from '@/lib/skuHelpers';

// --- API CLIENT ---

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
  return res.json();
};

// --- DATA MAPPERS ---

const mapJobFromBackend = (data: any): Job => ({
  id: data.id,
  inputString: data.input_raw || '',
  mpn: data.firstMpn || '',
  brand: '', // Helper to extract brand not always available in list view
  status: (data.status as JobStatus) || 'running',
  createdAt: new Date(data.startTime),
  updatedAt: new Date(data.endTime || data.startTime),
  cost: data.cost || 0,
  duration: data.endTime && data.startTime ? new Date(data.endTime).getTime() - new Date(data.startTime).getTime() : 0,
  tokenUsage: data.tokenUsage || 0,
});

const mapSKUFromBackend = (item: any): SKUData | null => {
  if (!item || !item.data) return null;
  const d = item.data as ConsumableData;
  const ev = d._evidence || {};

  const mapField = (field: string, val: any): SKUField => ({
    value: val || null,
    status: ev[field]?.status === 'verified' ? 'verified' : ev[field]?.is_conflict ? 'conflict' : 'pending',
    confidence: ev[field]?.confidence || 0,
    source: ev[field]?.source_url,
  });

  return {
    id: item.id,
    mpn: mapField('mpn', d.mpn_identity?.mpn || null),
    brand: mapField('brand', d.brand),
    yield: mapField('yield', d.tech_specs?.yield?.value),
    dimensions: mapField('dimensions', d.logistics?.package_weight_g ? `${d.logistics.width_mm}x${d.logistics.height_mm}` : null),
    weight: mapField('weight', d.logistics?.package_weight_g ? `${d.logistics.package_weight_g}g` : null),
    heroImage: d.product_image_main ? { url: d.product_image_main, qcStatus: 'pending' } : undefined,
    // Store raw claims/evidence for getEvidence()
    customFields: {
        _rawClaims: { value: item, status: 'pending' } // Bridge to support legacy evidence viewers expecting full item object
    }
  };
};

// --- HOOKS ---

export function useJobs() {
  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const data = await fetchJson('/api/jobs');
      return (data.jobs || []).map(mapJobFromBackend);
    },
    refetchInterval: 5000,
  });
}

export function useJob(id: string | null) {
  return useQuery<Job>({
    queryKey: ['job', id],
    queryFn: async () => {
      if (!id) throw new Error('No ID');
      const data = await fetchJson(`/api/jobs?id=${id}`);
      return mapJobFromBackend(data.jobs[0]);
    },
    enabled: !!id,
    refetchInterval: 2000,
  });
}

export function useJobItems(jobId: string | undefined) {
  return useQuery<SKUData[]>({
    queryKey: ['items', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const data = await fetchJson(`/api/items?jobId=${jobId}`);
      return (data.items || []).map(mapSKUFromBackend).filter(Boolean);
    },
    enabled: !!jobId,
    refetchInterval: 3000,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => fetchJson('/api/stats'),
    refetchInterval: 10000,
  });
}

export function useAuditLogs() {
  return useQuery<AuditEntry[]>({
    queryKey: ['audit'],
    queryFn: async () => {
      const data = await fetchJson('/api/audit');
      return (data.events || []).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
        // Map backend generic fields to frontend AuditEntry expectations
        action: e.action || 'update',
        fieldName: e.reason || 'Data Change',
        jobId: e.entityId, // Approximation
      }));
    },
  });
}

// --- SSE HOOK ---

export function useAgentMessages(jobId: string | null) {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const queryClient = useQueryClient();

    React.useEffect(() => {
        if (!jobId) {
            setMessages([]);
            return;
        }

        const es = new EventSource(`/api/sse?jobId=${jobId}`);
        
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'logs') {
                    setMessages(prev => {
                        const newLogs = data.logs.map((l: any) => ({
                            id: l.id,
                            type: l.type === 'info' ? 'activity' : l.type === 'error' ? 'blocker' : 'decision',
                            content: l.message,
                            timestamp: new Date(l.timestamp),
                            agentName: l.agent,
                            taskId: l.jobId
                        }));
                        // Deduplicate based on ID provided by backend
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNewLogs = newLogs.filter((l: any) => !existingIds.has(l.id));
                        return [...prev, ...uniqueNewLogs];
                    });
                } else if (data.type === 'update' || data.type === 'data_update') {
                    // Refresh queries on state change
                    queryClient.invalidateQueries({ queryKey: ['job', jobId] });
                    queryClient.invalidateQueries({ queryKey: ['items', jobId] });
                }
            } catch (e) {
                console.error("SSE Parse Error", e);
            }
        };

        return () => {
            es.close();
        };
    }, [jobId, queryClient]);

    return messages;
}

// --- MUTATIONS ---

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: string) => {
      const res = await fetch('/api/start-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, mode: 'balanced' }),
      });
      if (!res.ok) throw new Error('Failed to start job');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { fieldName: string; selectedValue: string; itemId: string }) => {
       // Using the existing put endpoint for manual override/resolution
       const res = await fetch('/api/items', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           id: payload.itemId,
           field: payload.fieldName,
           value: payload.selectedValue,
           source: 'manual_resolution'
         })
       });
       if (!res.ok) throw new Error('Failed to resolve conflict');
       return res.json();
    },
    onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['items'] });
       queryClient.invalidateQueries({ queryKey: ['job'] });
    }
  });
}

// --- CONFIG HOOKS ---

export function useSystemConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const data = await fetchJson('/api/config');
      return {
        budgetCaps: data.budgetCaps || {},
        llmSettings: data.llmSettings || {},
        sourcePriorities: data.sourcePriorities || [],
      };
    },
    refetchOnWindowFocus: false,
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { key: string; value: any }) => {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

export function usePublishItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, target }: { id: string; target: string }) => {
      return api.publishItem(id, target);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

// --- REAL DATA HOOK ---

export function useRealData() {
  const { data: jobs = [] } = useJobs();
  const { data: stats } = useDashboardStats();
  const { data: auditEntries = [] } = useAuditLogs();
  
  // Config Hook
  const { data: systemConfig = { budgetCaps: {}, llmSettings: {}, sourcePriorities: [] } } = useSystemConfig();
  const updateConfigMutation = useUpdateConfig();

  const createJobMutation = useCreateJob();
  const resolveConflictMutation = useResolveConflict();
  const publishItemMutation = usePublishItem();

  // Selected Job State
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  
  // Real-time Agent Logs
  const agentMessages = useAgentMessages(selectedJob?.id || null);

  // When a job is selected, fetch its items
  const { data: items = [] } = useJobItems(selectedJob?.id);
  
  // We treat the first item as the main SKU for the workspace view
  const skuData = items[0] || null;

  // Use aggregated stats if available, otherwise sum from loaded jobs as fallback
  const totalTokens = jobs.reduce((acc, j) => acc + (j.tokenUsage || 0), 0);
  const totalCost = jobs.reduce((acc, j) => acc + (j.cost || 0), 0);
  const totalCalls = stats?.searches || 0;

  const budgetData: BudgetData = {
    tokenUsage: totalTokens,
    tokenLimit: 1000000, 
    estimatedCost: totalCost,
    costLimit: 50.00, 
    apiCalls: totalCalls,
    apiCallLimit: 5000,
  };

  const selectJob = (job: Job) => setSelectedJob(job);

  const createJob = (input: string) => {
    createJobMutation.mutate(input);
  };
  
  const resolveConflict = (resolution: { fieldName: string; selectedValue: string; source: string; reasoning?: string }) => {
    if (skuData) {
        resolveConflictMutation.mutate({
            itemId: skuData.id,
            fieldName: resolution.fieldName,
            selectedValue: resolution.selectedValue
        });
    }
  };

  // Evidence selector helper (extracts from loaded skuData)
  const getEvidence = (fieldName: string) => {
      if (!skuData?.customFields?._rawClaims?.value) return [];
      
      const rawItem = skuData.customFields._rawClaims.value as unknown as EnrichedItem;
      const rawData = rawItem.data;
      const ev = rawData._evidence?.[fieldName];
      
      if (!ev) return [];
      
      return [{
          id: `${skuData.id}-${fieldName}`,
          fieldName,
          value: String(ev.value || ''),
          sourceUrl: ev.source_url || '',
          sourceType: (ev.method as any) || 'official', 
          snippet: ev.raw_snippet || '', 
          confidence: ev.confidence || 0,
          verified: ev.status === 'verified',
          fetchedAt: ev.timestamp ? new Date(ev.timestamp) : new Date(),
      }];
  };

  const addAuditEntry = async (entry: any) => {
    try {
      // Map frontend entry to backend schema
      const payload = {
        ...entry,
        entityType: entry.entityType || 'item',
        entityId: entry.entityId || entry.jobId,
        // Ensure userId is set
        userId: entry.userId || 'system',
      };
      await api.createAuditEntry(payload);
    } catch (e) {
      console.error('Failed to create audit entry', e);
    }
  };
  
  // Real implementation of setSystemConfig
  const setSystemConfig = (key: string, value: any) => {
    updateConfigMutation.mutate({ key, value });
  };
  
  const publishItem = async (id: string, target: string) => {
      await publishItemMutation.mutateAsync({ id, target });
  };
  
  const getFilterCounts = () => ({
      all: jobs.length,
      running: jobs.filter((j: Job) => j.status === 'running').length,
      completed: jobs.filter((j: Job) => j.status === 'completed').length,
      failed: jobs.filter((j: Job) => j.status === 'failed').length,
      needs_review: jobs.filter((j: Job) => j.status === 'needs_review').length,
      blocked: jobs.filter((j: Job) => j.status === 'blocked').length,
      ready_to_publish: jobs.filter((j: Job) => j.status === 'ready_to_publish').length
  });

  return {
    jobs,
    selectedJob,
    agentMessages, 
    skuData,
    budgetData,
    isProcessing: selectedJob?.status === 'running',
    auditEntries,
    systemConfig,
    validationBlockers: React.useMemo(() => {
        if (!skuData?.customFields?._rawClaims?.value) return [];
        const item = skuData.customFields._rawClaims.value as unknown as EnrichedItem;
        const rawBlockers = getPublishingBlockers(item);
        
        return ['ozon', 'yandex', 'wildberries'].flatMap(channel => 
            rawBlockers.map((msg, i) => ({
                id: `blk-${channel}-${i}`,
                channel: channel as any,
                severity: 'critical',
                message: msg,
                canAutoFix: false
            } as ValidationBlocker))
        );
    }, [skuData]),
    selectJob,
    createJob,
    getEvidence,
    getFilterCounts,
    setSystemConfig,
    resolveConflict,
    addAuditEntry,
    publishItem,
  };
}
