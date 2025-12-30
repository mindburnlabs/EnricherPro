export const triggerResearch = async (input: string) => { return fetch('/api/start-research', { method: 'POST', body: JSON.stringify({ input }), headers: { 'Content-Type': 'application/json' } }).then(r => r.json()); }

export const getItems = async (jobId: string) => {
    return fetch(`/api/items?jobId=${jobId}`).then(r => r.json());
}

export const approveItem = async (itemId: string) => {
    return fetch('/api/approve', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());
}
