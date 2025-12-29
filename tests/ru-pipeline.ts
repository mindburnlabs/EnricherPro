import { orchestrationService } from '../services/orchestrationService';

import { ConsumableData } from '../types';

async function runTest() {
    const query = "CF244A"; // Popular HP toner
    console.log(`Starting test pipeline for: ${query}`);

    try {
        const result = await orchestrationService.processItem(query, (step) => {
            console.log(`[PROGRESS] ${step}`);
        });

        console.log("Pipeline processing complete.");
        console.log("Result Status:", result.status);
        console.log("Validation Errors:", result.validation_errors);

        if (result.data) {
            console.log("Enriched Data:", JSON.stringify(result.data, null, 2));

            if (result.data._evidence) {
                console.log("Evidence Keys:", Object.keys(result.data._evidence));
            }
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
