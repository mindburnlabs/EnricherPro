export const triggerResearch = async (input: string) => { return fetch('/api/start-research', { method: 'POST', body: JSON.stringify({ input }) }).then(r => r.json()); }
