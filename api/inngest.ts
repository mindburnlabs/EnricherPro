import { serve } from "inngest/express";
import { inngest } from "./_lib/inngest.js";
// Note: We might still face issues with src import if not bundled, but let's try .js first
import { researchWorkflow } from "../src/inngest/functions/researchWorkflow.js";
import { graphIngestionScheduled, graphIngestionOnComplete } from "../src/inngest/functions/graphIngestion.js";
import { skuEnrichment } from "../src/inngest/functions/skuEnrichment.js";

// Expose Inngest API via default export for Vercel Serverless Functions
// Using inngest/express allows for standard Node request/response handling
export default serve({
    client: inngest,
    functions: [
        researchWorkflow,
        graphIngestionScheduled,
        graphIngestionOnComplete,
        skuEnrichment,
    ],
});
