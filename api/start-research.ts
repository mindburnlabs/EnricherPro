
import { inngest } from "./_lib/inngest";

export const POST = async (request: Request) => {
    const body = await request.json();
    const { input } = body;

    const jobId = crypto.randomUUID();

    // Send event to Inngest
    await inngest.send({
        name: "app/research.started",
        data: {
            jobId,
            inputRaw: input,
        },
    });

    return new Response(JSON.stringify({ success: true, jobId }), {
        headers: { 'Content-Type': 'application/json' }
    });
};
