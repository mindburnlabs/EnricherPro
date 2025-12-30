
import { serve } from "inngest/edge";
import { inngest } from "../../src/inngest/client";
import { researchWorkflow } from "../../src/inngest/functions/researchWorkflow";

// Expose Inngest API
export const GET = serve({
    client: inngest,
    functions: [
        researchWorkflow
    ],
});

export const POST = serve({
    client: inngest,
    functions: [
        researchWorkflow
    ],
});
