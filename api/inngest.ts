
import { serve } from "inngest/next";
import { inngest } from "../src/inngest/client";
import { researchWorkflow } from "../src/inngest/functions/researchWorkflow";

// Expose Inngest API via default export for Vercel Serverless Functions
export default serve({
    client: inngest,
    functions: [
        researchWorkflow
    ],
});
