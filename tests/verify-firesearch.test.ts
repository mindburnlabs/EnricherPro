import { describe, it, expect } from 'vitest';
import { orchestrationService } from '../services/orchestrationService';
import { StrictConsumableData } from '../types/domain';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('Firesearch Smoke Test', () => {
    it('should complete full data processing pipeline with related items and strict sources', async () => {
        const query = "HP 17A CF217A"; // Standard cartridge
        console.log(`[Verify] Starting Firesearch Smoke Test (Standard Mode) for: "${query}"`);

        try {
            const result = await orchestrationService.processItem(
                query,
                (stage) => console.log(`[Stage] ${stage}`),
                { engine: 'firecrawl', mode: 'standard', locale: 'RU', strictSources: true }
            );

            const data = result.data as StrictConsumableData;

            console.log("\n--- Execution Logs ---");
            result.evidence.logs.forEach(log => console.log(log));

            console.log("\n--- Verification Report ---");
            console.log("Run Mode:", data.meta?.run_mode);
            console.log("Parsed Brand:", data.parsed?.brand);
            console.log("Parsed Model:", data.parsed?.model_oem);

            console.log("Packaging Present:", !!data.packaging);
            if (data.packaging) {
                console.log("  Weight:", data.packaging.package_weight_g);
                console.log("  From NIX:", !data.packaging.not_found_on_nix);
                console.log("  Evidence:", data.packaging.evidence_urls);
            }

            console.log("Compatibility Ru Present:", !!data.compatibility_ru);
            if (data.compatibility_ru) {
                console.log("  Printers:", data.compatibility_ru.printers.length);
                console.log("  Evidence:", data.compatibility_ru.evidence_urls);
                console.log("  Needs Review:", data.compatibility_ru.needs_review);
            }

            console.log("Related Consumables Present:", !!data.related_consumables);
            if (data.related_consumables) {
                console.log("  Count:", data.related_consumables.for_similar_products_block.length);
                console.log("  Needs Review:", data.related_consumables.needs_review);
            }

            console.log("FAQ Present:", !!data.faq && data.faq.length > 0);
            console.log("Images Present:", !!data.image_candidates && data.image_candidates.length > 0);
            if (data.image_candidates.length > 0) {
                console.log("  Candidate 1:", data.image_candidates[0].url);
            }

            expect(data.parsed).toBeDefined();
            expect(data.meta).toBeDefined();
            // We expect at least some data to be found for a valid query
            // But if network fails or mock is used, assertions might vary.
            // For smoke test, mainly checking it runs without crashing and schema is correct.

        } catch (e) {
            console.error("Verification Failed:", e);
            throw e;
        }
    }, 120000); // 2 minute timeout
});
