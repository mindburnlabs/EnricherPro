
import { ItemsRepository } from '../src/repositories/itemsRepository';

export const GET = async (request: Request) => {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
        return new Response(JSON.stringify({ error: 'Missing jobId' }), { status: 400 });
    }

    try {
        // In a real app we might return multiple items.
        // For MVP 1 job = 1 item mostly.
        const item = await ItemsRepository.findByJobId(jobId);

        // Wrap in array for ReviewQueue compatibility
        const items = item ? [item] : [];

        return new Response(JSON.stringify({ success: true, items }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
