import { serve } from "inngest/express";
import { inngest } from "./_lib/inngest";
import { researchWorkflow } from "../src/inngest/functions/researchWorkflow";

// Expose Inngest API via default export for Vercel Serverless Functions
// Using inngest/express allows for standard Node request/response handling
export default serve({
    client: inngest,
    functions: [
        researchWorkflow
    ],
});
