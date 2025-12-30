
import { ItemsRepository } from "../src/repositories/itemsRepository";

export const GET = async (request: Request) => {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
        return new Response("Missing jobId", { status: 400 });
    }

    // In a real Inngest app, we might query Inngest API for step status
    // OR we just check our DB to see if the item was created/updated
    // For this MVP, we check the DB item linked to the job

    // Note: ItemsRepository needs to find by Job ID. 
    // We didn't explicitly make findByJobId, but we can query by job_id manually or add helper.
    // For MVP, assuming 1 item per research job for now (from ResearchWorkflow).

    // Actually, ItemsRepository.create returns the item. 
    // Let's add a findByJobId to ItemsRepository first? 
    // Or just SQL query here? Better to stick to Repo pattern if possible, 
    // but let's check ItemsRepository content first.

    // Workaround: We don't have findByJobId in Repo yet.
    // Let's assume the frontend polls with the JOB ID? 
    // The 'triggerResearch' returns 'jobId'.
    // The workflow creates an item with 'jobId'.

    // Let's try to fetch the item by job_id. 
    // We need to import 'db' and 'items' if Repo doesn't have it.

    const item = await ItemsRepository.findByJobId(jobId);

    if (!item) {
        // Job started but item not in DB yet (Workflow 'planning' phase maybe?)
        // Or invalid ID.
        return new Response(JSON.stringify({ status: "pending", steps: [] }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Map DB status to UI steps
    // This is a simplification. Ideally Inngest sends events to client via SSE.
    // Here we just infer progress from DB state.

    const steps = [];

    if (item.status === 'processing') {
        steps.push({ id: 'research', label: 'status.searching', status: 'running' });
    } else if (item.status === 'needs_review') {
        steps.push({ id: 'research_done', label: 'status.complete', status: 'completed' });
        steps.push({ id: 'review', label: 'status.review_required', status: 'running', message: item.reviewReason });
    } else if (item.status === 'published') {
        steps.push({ id: 'research_done', label: 'status.complete', status: 'completed' });
        steps.push({ id: 'published', label: 'status.published', status: 'completed' });
    }

    return new Response(JSON.stringify({
        status: item.status,
        steps,
        result: item.data // Return the enriched data!
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
};
