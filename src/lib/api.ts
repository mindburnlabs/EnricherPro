export const triggerResearch = async (input: string, mode: 'fast' | 'balanced' | 'deep' = 'balanced', options?: { forceRefresh?: boolean, apiKeys?: Record<string, string>, agentConfig?: any, sourceConfig?: any, budgets?: any, previousJobId?: string, model?: string, useFlashPlanner?: boolean }) => {
    const res = await fetch('/api/start-research', { method: 'POST', body: JSON.stringify({ input, mode, ...options }), headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            throw new Error(json.error || json.details || text);
        } catch (e) {
            throw new Error(`Server Error (${res.status}): ${text}`);
        }
    }
    return res.json();
}

export const getItems = async (jobId: string) => {
    return fetch(`/api/items?jobId=${jobId}`).then(r => r.json());
}

export const getItem = async (id: string) => {
    return fetch(`/api/items?id=${id}`).then(r => r.json().then(data => data.items?.[0]));
}

export const approveItem = async (itemId: string) => {
    return fetch('/api/approve', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());
}

export const archiveItem = async (itemId: string) => {
    return fetch('/api/archive', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());
}

export const resolveConflict = async (itemId: string, resolution: 'keep_current' | 'replace' | 'merge', targetId?: string) => {
    return fetch('/api/resolve-conflict', {
        method: 'POST',
        body: JSON.stringify({ itemId, resolution, targetId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());
}
