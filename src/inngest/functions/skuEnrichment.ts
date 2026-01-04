import { inngest } from '../client.js';
import { db } from '../../db/index.js';
import { jobs, skus } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { ExtractorAgent } from '../../services/agents/ExtractorAgent.js';

// Event Definition - normally in a types file, but defined inline here for clarity
// { name: "app/sku.enrichment.started", data: { jobId: string, skuId: string, supplierString: string } }

export const skuEnrichment = inngest.createFunction(
  { id: 'sku-enrichment-orchestrator', name: 'SKU Enrichment Orchestrator' },
  { event: 'app/sku.enrichment.started' },
  async ({ event, step, logger }) => {
    const { jobId, skuId, supplierString } = event.data;

    // 1. Initial Logging
    await step.run('log-start', async () => {
      logger.info(`Starting enrichment for Job ${jobId}, SKU ${skuId}`);
      await db.update(jobs).set({ status: 'running', progress: 5 }).where(eq(jobs.id, jobId));
    });

    // 2. Initial Extraction (Plan & Extract)
    // For now, we simulate a "Search" step or just assume we have some inputs.
    // The Spec says: "Plan -> Delegate -> Monitor".
    // Here we'll do a simple loop: Extract from Supplier String -> Search -> Extract.

    // Step 2a: Parse Supplier String
    const initialExtraction = await step.run('extract-from-string', async () => {
      return await ExtractorAgent.extract(supplierString, { source: 'supplier_string' }, (msg) =>
        logger.info(msg),
      );
    });

    // Update SKU with initial findings (MPN, Brand)
    await step.run('update-sku-initial', async () => {
      if (initialExtraction?.mpn_identity?.mpn) {
        await db
          .update(skus)
          .set({
            mpn: initialExtraction.mpn_identity.mpn,
            brand: initialExtraction.brand,
            updatedAt: new Date(),
          })
          .where(eq(skus.id, skuId));
      }
    });

    // 3. Search & Enrich Loop
    const plan = await step.run('plan-research', async () => {
      // Use DiscoveryAgent to plan queries based on initial extraction or raw string
      return await import('../../services/agents/DiscoveryAgent.js').then((m) =>
        m.DiscoveryAgent.plan(supplierString, 'balanced', {}, undefined, (msg) => logger.info(msg)),
      );
    });

    // Execute Strategy 1: "Generic Web Search" (simulated via GenericScraper)
    // In a real app, we'd map plan.strategies to specific adapters.
    const searchResults = await step.run('execute-search', async () => {
      const queries = plan.strategies.flatMap((s) => s.queries).slice(0, 3); // Limit to top 3 queries for MVP
      const scraper = new (
        await import('../../services/backend/GenericScraper.js')
      ).GenericScraper();

      const allResults = [];
      for (const q of queries) {
        const results = await scraper.fetch(q);
        allResults.push(...results);
      }
      return allResults;
    });

    // 4. Extract Claims from Evidence
    const extractedClaims = await step.run('extract-claims', async () => {
      const claims = [];
      for (const result of searchResults) {
        // Save Evidence First
        const [evidence] = await db
          .insert(await import('../../db/schema.js').then((m) => m.evidenceRecords))
          .values({
            sourceUrl: result.url,
            sourceType: 'generic',
            contentSnippet: result.contentSnippet || '',
            contentHash: result.contentHash || 'hash_' + Date.now(),
            priorityScore: result.priorityScore,
          })
          .returning();

        // Extract Data
        const data = await ExtractorAgent.extract(result.contentSnippet || '', { url: result.url });

        // Map extracted data to Claims
        // Flatten ConsumableDataSchema: strictly only primitives for now
        const flatData: Record<string, string> = {};
        if (data.mpn_identity?.mpn) flatData.mpn = data.mpn_identity.mpn;
        if (data.tech_specs?.yield?.value)
          flatData.yield_amount = String(data.tech_specs.yield.value);
        if (data.logistics?.package_weight_g)
          flatData.weight_g = String(data.logistics.package_weight_g);

        for (const [key, value] of Object.entries(flatData)) {
          if (value) {
            const [claim] = await db
              .insert(await import('../../db/schema.js').then((m) => m.enrichedClaims))
              .values({
                skuId,
                fieldName: key,
                fieldValue: String(value), // Ensure string
                status: 'pending',
                evidenceId: evidence.id,
                confidenceScore: String(evidence.priorityScore), // Simple mapping
              })
              .returning();
            claims.push(claim);
          }
        }
      }
      return claims;
    });

    // 5. Verify & Resolve
    await step.run('verify-resolve', async () => {
      // ... existing verify logic ...
      const { Verifier } = await import('../../services/logic/Verifier.js');
      const { ConflictResolver } = await import('../../services/logic/ConflictResolver.js');

      const allClaims = await db.query.enrichedClaims.findMany({
        where: eq(await import('../../db/schema.js').then((m) => m.enrichedClaims.skuId), skuId),
      });

      const report = Verifier.verify(allClaims);

      for (const [field, verification] of Object.entries(report.fields)) {
        const resolution = ConflictResolver.resolve(verification);
        if (resolution.status === 'resolved' && resolution.resolvedValue) {
          const updatePayload: any = {};
          if (field === 'mpn') updatePayload.mpn = resolution.resolvedValue;
          if (field === 'weight_g')
            updatePayload.packageWeightG = parseInt(resolution.resolvedValue);
          if (Object.keys(updatePayload).length > 0) {
            await db.update(skus).set(updatePayload).where(eq(skus.id, skuId));
          }
        }
      }
    });

    // 6. Mine Compatibility (New Step)
    await step.run('mine-compatibility', async () => {
      const { CompatibilityMinerAgent } =
        await import('../../services/agents/CompatibilityMinerAgent.js');
      const { CompatibilityGraphBuilder } =
        await import('../../services/logic/CompatibilityGraphBuilder.js');

      // Use the supplier string or extracted MPN as the seed
      const currentSku = await db.query.skus.findFirst({
        where: eq(skus.id, skuId),
      });
      const searchTerm = currentSku?.mpn || supplierString;

      const results = await CompatibilityMinerAgent.mine(searchTerm, (msg) => logger.info(msg));

      for (const res of results) {
        await CompatibilityGraphBuilder.build(
          skuId,
          res.printers,
          res.sourceUrl || 'unknown',
          currentSku?.brand || 'Unknown',
        );
      }
    });

    // Finalize
    await step.run('finalize-job', async () => {
      await db
        .update(jobs)
        .set({ status: 'completed', progress: 100, endTime: new Date() })
        .where(eq(jobs.id, jobId));
    });

    return { success: true, count: searchResults.length };
  },
);
