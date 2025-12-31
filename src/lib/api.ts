export const triggerResearch = async (input: string, mode: 'fast' | 'balanced' | 'deep' = 'balanced', options?: { forceRefresh?: boolean, apiKeys?: Record<string, string>, sourceConfig?: any, budgets?: any }) => { return fetch('/api/start-research', { method: 'POST', body: JSON.stringify({ input, mode, ...options }), headers: { 'Content-Type': 'application/json' } }).then(r => r.json()); }

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
