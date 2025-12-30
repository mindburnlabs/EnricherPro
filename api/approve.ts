
import { ItemsRepository } from '../src/repositories/itemsRepository';

export const POST = async (request: Request) => {
    try {
        const body = await request.json();
        const { itemId } = body;

        if (!itemId) {
            return new Response(JSON.stringify({ error: 'Missing itemId' }), { status: 400 });
        }

        await ItemsRepository.setStatus(itemId, 'published');

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
};
