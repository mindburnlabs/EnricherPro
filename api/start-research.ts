
import { inngest } from "./_lib/inngest";
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { input } = request.body;

        if (!input) {
            return response.status(400).json({ error: 'Missing input' });
        }

        const jobId = uuidv4();

        // Send event to Inngest
        try {
            await inngest.send({
                name: "app/research.started",
                data: {
                    jobId,
                    inputRaw: input,
                },
            });
        } catch (inngestError) {
            console.error("Inngest Send Error:", inngestError);
            return response.status(500).json({ error: 'Failed to trigger workflow', details: String(inngestError) });
        }

        return response.status(200).json({ success: true, jobId });
    } catch (error) {
        console.error("API Error:", error);
        return response.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
