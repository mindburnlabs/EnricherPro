import { inngest } from '../client.js';
import { OrchestratorAgent } from '../../services/agents/OrchestratorAgent.js';
import { DiscoveryAgent, AgentPlan } from '../../services/agents/DiscoveryAgent.js';
import { z } from 'zod';
import type {
  ResearchEventData,
  ResearchResult,
  hasEvidence,
  createGraphLiteUrl,
} from '../../types/workflow.js';
import { processTask, processUrlBatch, flattenClaims, type WorkflowContext } from '../utils/workflowUtils.js';

// SafeClaimSchema moved to utils

export const researchWorkflow = inngest.createFunction(
  {
    id: 'research-workflow',
    concurrency: { limit: 5 },
    retries: 3,
    onFailure: async ({ event, error }) => {
      const eventData = (event as any).event?.data || event.data;
      const { jobId } = eventData as ResearchEventData;
      console.error(`[Workflow Failed] Job ${jobId}:`, error);
      const agent = new OrchestratorAgent(jobId);
      await agent.fail(error);
    },
  },
  { event: 'app/research.started' },
  async ({ event, step }) => {
    const {
      jobId,
      tenantId,
      inputRaw,
      mode = 'balanced',
      forceRefresh,
      apiKeys,
      agentConfig,
      sourceConfig,
      budgets,
      previousJobId,
      language = 'en',
      model,
      useFlashPlanner = true,
    } = event.data as any; // Cast to any to handle custom event payload
    const agent = new OrchestratorAgent(jobId, apiKeys, tenantId);

    // 1. Initialize DB Record
    const { item, isCached } = await step.run('create-db-item', async () => {
      return await agent.getOrCreateItem(inputRaw, forceRefresh);
    });

    // EFFICIENCY UPGRADE: Cache Hit
    if (isCached) {
      await step.run('log-cache-hit', () =>
        agent.log('orchestrator', '⚡ Using cached data from Database. Skipping research.'),
      );
      return {
        success: true,
        itemId: item.id,
        status: item.status,
        cached: true,
        _evidence: item.data?._evidence, // Pass through evidence if needed for UI immediate render
      };
    }

    // REFINEMENT CONTEXT
    let context = undefined;
    if (previousJobId) {
      context = await step.run('fetch-context', async () => {
        return (await agent.getContext(previousJobId)) || undefined;
      });
    }

    // 2. Planning (HYDRA UPGRADE)
    await step.run('transition-planning', () => agent.transition('planning'));
    const plan = await step.run('generate-plan', async () => {
      const { DiscoveryAgent } = await import('../../services/agents/DiscoveryAgent.js');
      const { StrategyRacer } = await import('../../services/logic/StrategyRacer.js');

      // HYDRA HEAD 1: Fast Guesser (Zero Latency)
      // If we can regex-match a likely URL, we skip the LLM Planner entirely.
      // This transforms the system from "Reactive" to "Predictive".
      const guessedUrl = StrategyRacer.guessUrl(inputRaw);
      if (guessedUrl) {
        // Verify strictness: Only skip plan if we are confident.
        // For B2B/MPN lookups, this is usually safe and much faster.
        agent.log(
          'discovery',
          `🐉 Hydra: Guesser predicted direct URL: ${guessedUrl}. Bypassing Planner.`,
        );
        return {
          type: 'single_sku',
          mpn: null,
          canonical_name: inputRaw,
          strategies: [
            {
              name: 'Hydra Direct Guess',
              type: 'url', // Frontier handles 'url' types by scraping
              queries: [], // No queries needed
              target_domain: new URL(guessedUrl).hostname,
              target_url: guessedUrl,
            },
          ],
          suggestedBudget: { mode: 'fast', concurrency: 2, depth: 0 },
        };
      }

      return await DiscoveryAgent.plan(
        inputRaw,
        mode,
        apiKeys,
        agentConfig?.prompts?.discovery,
        (msg) => agent.log('discovery', msg),
        context, // Pass context
        language, // Pass language
        model, // Pass selected model
        sourceConfig, // Pass source configuration for prompt injection
        useFlashPlanner, // Pass Flash Planner configuration
      );
    });

    // 3. Execution (Frontier Loop - Time Sliced SOTA)
    await step.run('transition-searching', () => agent.transition('searching'));

    // HOISTED IMPORTS & SHARED HELPERS
    const { FrontierService } = await import('../../services/frontier/FrontierService.js');
    const { BackendFirecrawlService } = await import('../../services/backend/firecrawl.js');
    const { FallbackSearchService } = await import('../../services/backend/fallback.js');
    const { LogisticsAgent } = await import('../../services/agents/LogisticsAgent.js');
    const { SourceDocumentRepository } =
      await import('../../repositories/SourceDocumentRepository.js');
    const { ClaimsRepository } = await import('../../repositories/ClaimsRepository.js');
    const { SynthesisAgent } = await import('../../services/agents/SynthesisAgent.js');
    const { DiscoveryAgent } = await import('../../services/agents/DiscoveryAgent.js');
    const { EnrichmentAgent } = await import('../../services/agents/EnrichmentAgent.js');

    let searchResults: any[] = [];
    let isFirecrawlExhausted = false; // Graceful degradation flag

    // Context for Utils
    const workflowContext: WorkflowContext = {
      jobId,
      agent,
      apiKeys,
      language,
      model,
      sourceConfig,
      agentConfig,
      item,
    };

    // Graph-Lite Path
    const planWithEvidence = plan as AgentPlan & { evidence?: Record<string, any> };
    if (planWithEvidence.evidence) {
      searchResults = await step.run('graph-lite-execution', async () => {
        agent.log(
          'discovery',
          '⚡ Graph-Lite Hit! Skipping web search to prioritize local knowledge.',
        );
        const graphUrl = `graph://${plan.mpn || 'internal'}`;
        const sourceDoc = await SourceDocumentRepository.create({
          jobId,
          url: graphUrl,
          domain: 'graph-lite.internal',
          rawContent: JSON.stringify(planWithEvidence.evidence),
          status: 'success',
          extractedMetadata: { title: 'Graph-Lite Entry', type: 'graph_lite' },
        });
        // Flatten Claims logic...
        const flatClaims = flattenClaims(planWithEvidence.evidence);
        if (flatClaims.length > 0) {
          await ClaimsRepository.createBatch(
            flatClaims.map((c: any) => ({
              itemId: item.id,
              sourceDocId: sourceDoc.id,
              field: c.field,
              value: typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
              confidence: 99,
            })),
          );
        }
        return [
          {
            url: graphUrl,
            title: 'Graph-Lite',
            markdown: JSON.stringify(planWithEvidence.evidence),
            source_type: 'graph_lite' as const,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    } else {
      // STANDARD FRONTIER EXECUTION

      // 1. Seed Frontier
      await step.run('seed-frontier', async () => {
        if (plan.strategies) {
          for (const strategy of plan.strategies) {
            if (strategy.type === 'url' && strategy.target_url) {
              await FrontierService.add(jobId, 'url', strategy.target_url, 100, 0, {
                strategy: strategy.name,
              });
            } else if (strategy.type === 'domain_crawl' && strategy.target_domain) {
              await FrontierService.add(
                jobId,
                'domain_crawl',
                strategy.target_url || strategy.target_domain,
                100,
                0,
                {
                  strategy: strategy.name,
                  target_domain: strategy.target_domain,
                  schema: (strategy as any).schema,
                },
              );
            } else if (strategy.type === 'domain_map' && strategy.target_domain) {
              await FrontierService.add(jobId, 'domain_map', strategy.target_domain, 100, 0, {
                strategy: strategy.name,
                queries: strategy.queries,
                schema: (strategy as any).schema,
              });
            } else {
              for (const query of strategy.queries) {
                await FrontierService.add(jobId, (strategy.type as any) || 'query', query, 50, 0, {
                  strategy: strategy.name,
                  target_domain: strategy.target_domain,
                  schema: (strategy as any).schema,
                });
              }
            }
          }
        }
      });

      // 2. Sliced Execution Loop
      // REPLACED THE OLD GIANT STEP WITH THIS LOOP

      // Loop Config
      const defaultBudget = { maxQueries: 10, limitPerQuery: 5, concurrency: 8 }; // UPGRADED to 8
      let MAX_LOOPS = mode === 'deep' ? 15 : 5;
      if (plan.suggestedBudget) {
        defaultBudget.concurrency = plan.suggestedBudget.concurrency;
        if (plan.suggestedBudget.mode === 'deep') MAX_LOOPS = 15;
        else if (plan.suggestedBudget.mode === 'fast') MAX_LOOPS = 2;
        else MAX_LOOPS = 7;
      }
      const budget =
        budgets && budgets[mode] ? { ...defaultBudget, ...budgets[mode] } : defaultBudget;
      const CONCURRENCY = budget.concurrency || 5;

      let done = false;
      let sliceIndex = 0;
      const MAX_SLICES = 30; // Hard limit on steps

      agent.log(
        'discovery',
        `🚀 Starting Sliding Window Execution (Target: ${CONCURRENCY} concurrent threads)...`,
      );

      while (!done && sliceIndex < MAX_SLICES) {
        const sliceOutput = await step.run(`frontier-slice-${sliceIndex}`, async () => {
          // HARD TIMEOUT: 45s per slice
          const SLICE_DURATION = 40000; // 40s to be safe
          const startTime = Date.now();
          const drainingStart = startTime + SLICE_DURATION - 5000;

          const sliceResults: any[] = [];
          const activePromises = new Set<Promise<any>>();

          // Check stats
          const initialStats = await FrontierService.stats(jobId);
          if (
            initialStats.pending === 0 &&
            initialStats.processing === 0 &&
            activePromises.size === 0
          ) {
            // Only mark done if pool empty
            return { results: [], done: true, exhausted: isFirecrawlExhausted };
          }

          // Run loop until time up
          while (Date.now() < drainingStart) {
            const freeSlots = CONCURRENCY - activePromises.size;
            if (freeSlots > 0) {
              const tasks = await FrontierService.nextBatch(jobId, freeSlots);
              if (tasks.length > 0) {
                // Separate URL for Batching
                const urlTasks = tasks.filter((t) => t.type === 'url');
                const otherTasks = tasks.filter((t) => t.type !== 'url');

                if (urlTasks.length > 1) {
                  const p = processUrlBatch(urlTasks, workflowContext, isFirecrawlExhausted).then(
                    async (res) => {
                      if (res.exhausted) isFirecrawlExhausted = true;
                      if (res.results && res.results.length > 0) {
                        sliceResults.push(...res.results);
                      }
                      // If batch failed/skipped, retry individually
                      if (res.count === 0 && res.results.length === 0) {
                        for (const t of urlTasks) {
                          try {
                            const indRes = await processTask(
                              t,
                              workflowContext,
                              isFirecrawlExhausted,
                            );
                            if (indRes.exhausted) isFirecrawlExhausted = true;
                            if (indRes.results) sliceResults.push(...indRes.results);
                          } catch (e) {}
                        }
                      }
                      activePromises.delete(p);
                    },
                  );
                  activePromises.add(p);
                } else if (urlTasks.length === 1) {
                  otherTasks.push(urlTasks[0]);
                }

                for (const t of otherTasks) {
                  const p = processTask(t, workflowContext, isFirecrawlExhausted).then((res) => {
                    if (res.exhausted) isFirecrawlExhausted = true;
                    if (res.results) sliceResults.push(...res.results);
                    activePromises.delete(p);
                  });
                  activePromises.add(p);
                }
              } else {
                // Queue Empty: Wait for active tasks
                if (activePromises.size === 0) {
                  return { results: sliceResults, done: true, exhausted: isFirecrawlExhausted };
                }
                await Promise.race(activePromises);
              }
            } else {
              // Pool Full: Wait for one
              await Promise.race(activePromises);
            }
          }

          // Time Up: Drain Active
          if (activePromises.size > 0) {
            agent.log(
              'system',
              `⏳ Slice ${sliceIndex} check: Draining ${activePromises.size} active tasks...`,
            );
            await Promise.all(activePromises);
          }

          return { results: sliceResults, done: false, exhausted: isFirecrawlExhausted };
        });

        if (Array.isArray(sliceOutput.results)) {
          searchResults.push(...sliceOutput.results);
        }

        if (sliceOutput.done) done = true;
        if (sliceOutput.exhausted) isFirecrawlExhausted = true; // State rehydration
        sliceIndex++;
      }

      // Zero Results Rescue
      if (searchResults.length === 0) {
        agent.log(
          'discovery',
          '⚠️ Primary search yielded 0 results. Initiating Emergency Fallback...',
        );
        try {
          const rescueQuery = plan.canonical_name || inputRaw;
          const rescueResults = await FallbackSearchService.search(rescueQuery, apiKeys);
          if (rescueResults && rescueResults.length > 0) {
            for (const r of rescueResults) {
              // Save & Push
              try {
                const sourceDoc = await SourceDocumentRepository.create({
                  jobId,
                  url: r.url,
                  domain: new URL(r.url).hostname,
                  rawContent: r.markdown,
                  status: 'success',
                  extractedMetadata: { title: r.title, type: 'fallback_rescue' },
                });
                const claims = await SynthesisAgent.extractClaims(
                  r.markdown || '',
                  r.url,
                  apiKeys,
                  undefined,
                  model,
                  language,
                );
                if (claims && claims.length > 0)
                  await ClaimsRepository.createBatch(
                    claims.map((c) => ({
                      itemId: item.id,
                      sourceDocId: sourceDoc.id,
                      field: c.field,
                      value:
                        typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
                      confidence: 50,
                    })),
                  );

                searchResults.push({
                  url: r.url,
                  title: r.title,
                  markdown: r.markdown,
                  source_type: 'fallback_rescue',
                  timestamp: new Date().toISOString(),
                });
              } catch (e) {}
            }
          }
        } catch (e) {}
      }

      // Logistics
      if (mode !== 'fast' && plan.canonical_name) {
        const logistics = await LogisticsAgent.checkNixRu(
          plan.canonical_name,
          apiKeys,
          (msg) => agent.log('logistics', msg),
          undefined,
          undefined,
          language,
        );
        if (logistics.url)
          searchResults.push({
            url: logistics.url,
            title: 'Logistics',
            markdown: `Weight: ${logistics.weight}`,
            source_type: 'nix_ru',
            timestamp: new Date().toISOString(),
          });
      }
    }

    // 4. Truth Resolution (Phase G)
    await step.run('transition-enrichment', () => agent.transition('enrichment'));
    const extractedData = await step.run('resolve-truth', async () => {
      const { ClaimsRepository } = await import('../../repositories/ClaimsRepository.js');
      const { TrustEngine } = await import('../../services/engine/TrustEngine.js');
      const { SynthesisAgent } = await import('../../services/agents/SynthesisAgent.js');
      const { MediaQCAgent } = await import('../../services/agents/MediaQCAgent.js');
      const { FAQGeneratorAgent } = await import('../../services/agents/FAQGeneratorAgent.js');

      const allClaims = await ClaimsRepository.findByItemId(item.id);
      const claimsByField: Record<string, any[]> = {};
      for (const claim of allClaims) {
        if (!claimsByField[claim.field]) claimsByField[claim.field] = [];
        claimsByField[claim.field].push(claim);
      }

      const resolvedData: any = { _evidence: {} };
      for (const field of Object.keys(claimsByField)) {
        const best = TrustEngine.resolveField(claimsByField[field]);
        if (best) {
          const parts = field.split('.');
          let curr = resolvedData;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          let val = best.value;
          try {
            val = JSON.parse(best.value as any);
          } catch (e) {}
          curr[parts[parts.length - 1]] = val;
          resolvedData._evidence[field] = {
            value: val,
            confidence: best.confidence,
            source_url: best.sources[0],
            timestamp: new Date().toISOString(),
            is_conflict: best.isConflict,
            method: best.method,
          };
        }
      }

      if (!resolvedData.brand) {
        agent.log(
          'synthesis',
          'Trust Engine yielded incomplete data. Activating Swarm Synthesis...',
        );
        const safeResults = searchResults || [];
        const combinedSources = safeResults.map(
          (r: any) => `Source: ${r.url} (${r.source_type})\n Title: ${r.title}\n---\n${r.markdown}`,
        );

        const synthesized = await SynthesisAgent.merge(
          combinedSources,
          'StrictConsumableData',
          apiKeys,
          agentConfig?.prompts?.synthesis,
          (msg) => agent.log('synthesis', msg),
          model,
          language,
          inputRaw,
        );

        // DYNAMIC REFLECTION
        let finalData = synthesized;
        let refinementLoop = 0;
        const MAX_LOOPS = 1;

        while (refinementLoop < MAX_LOOPS) {
          const repairs = await DiscoveryAgent.critique(finalData, language, apiKeys, (msg) =>
            agent.log('reflection', msg),
          );
          if (repairs.length === 0) break;

          agent.log(
            'reflection',
            `⚠️ Critique found gaps in Draft ${refinementLoop + 1}. Starting Repair Loop...`,
          );
          // 1. Execute Repairs
          const repairSources = await (async () => {
            const repairTasks = repairs.map((r) => ({
              type: 'query',
              value: r.value,
              meta: { goal: r.goal },
            }));
            const { BackendFirecrawlService } = await import('../../services/backend/firecrawl.js');
            const { SourceDocumentRepository } =
              await import('../../repositories/SourceDocumentRepository.js');

            const repairResults = await Promise.all(
              repairTasks.map(async (t: any) => {
                if (isFirecrawlExhausted) return []; // Skip repair if no credits

                const searchRes = await BackendFirecrawlService.search(t.value, {
                  limit: 5,
                  apiKey: apiKeys?.firecrawl,
                });
                const relevantIndices = await DiscoveryAgent.filterResults(
                  searchRes,
                  t.value,
                  apiKeys,
                  'en',
                  (msg) => agent.log('discovery', msg),
                );
                const bestCandidates = relevantIndices.map((i) => searchRes[i]);

                const scraped = await Promise.all(
                  bestCandidates.map(async (c: any) => {
                    try {
                      const cached = await SourceDocumentRepository.findByUrl(c.url);
                      if (cached && Date.now() - new Date(cached.crawledAt).getTime() < 86400000)
                        return { ...c, markdown: cached.rawContent };
                    } catch (e) {}
                    try {
                      const d = await BackendFirecrawlService.scrape(c.url, {
                        formats: ['markdown'],
                        apiKey: apiKeys?.firecrawl,
                      });
                      return { ...c, markdown: (d as any).markdown };
                    } catch (e: any) {
                      if (e.statusCode === 402) isFirecrawlExhausted = true;
                      return null;
                    }
                  }),
                );
                return scraped
                  .filter(Boolean)
                  .map((d: any) => `Source: ${d.url}\nTitle: ${d.title}\nSnippet: ${d.markdown}`);
              }),
            );
            return repairResults.flat();
          })();

          if (repairSources.length > 0) {
            agent.log('synthesis', `Incorporating ${repairSources.length} repair sources...`);
            const repairData = await SynthesisAgent.merge(
              repairSources,
              'StrictConsumableData',
              apiKeys,
              agentConfig?.prompts?.synthesis,
              undefined,
              model,
              language,
            );
            const metaMergeSources = [
              `EXISTING_DRAFT_JSON:\n${JSON.stringify(finalData)}`,
              `NEW_REPAIR_DATA_JSON:\n${JSON.stringify(repairData)}`,
            ];
            finalData = await SynthesisAgent.merge(
              metaMergeSources,
              'StrictConsumableData',
              apiKeys,
              agentConfig?.prompts?.synthesis,
              undefined,
              model,
              language,
            );
          }
          refinementLoop++;
        }
        return { ...finalData, ...resolvedData };
      }

      // Finalize MPN
      if (!resolvedData.mpn_identity) {
        const inferred = resolvedData.model || resolvedData.short_model || inputRaw;
        resolvedData.mpn_identity = {
          mpn: inferred,
          canonical_model_name: inputRaw,
          variant_flags: { chip: false, counterless: false, high_yield: false, kit: false },
        };
      }

      return resolvedData;
    });

    // 4.5 Polish (FAQ & Media QC) - Ensuring 'finalData' is defined
    await step.run('transition-polish', () => agent.transition('polish' as any));
    const polishedData = await step.run('polish-data', async () => {
      // Re-import to be safe or use outer scope if available. Use dynamic import inside step to ensure scope.
      const { MediaQCAgent } = await import('../../services/agents/MediaQCAgent.js');
      const { FAQGeneratorAgent } = await import('../../services/agents/FAQGeneratorAgent.js');

      const currentData = { ...extractedData }; // Clone

      // Media QC
      try {
        const qc = await MediaQCAgent.validateImages(currentData as any);
        agent.log('polish', `🖼️ Media QC: ${qc.passed ? 'PASSED' : 'WARNING'} - ${qc.report[0]}`);
        // We don't block on failure, just log metadata
        currentData._media_qc = qc;
      } catch (e) {
        console.warn('Media QC Error', e);
      }

      // FAQ Generation
      try {
        if (!currentData.faqs || currentData.faqs.length === 0) {
          agent.log('polish', 'Generating FAQs from technical specs...');
          const faqs = await FAQGeneratorAgent.generateFAQ(currentData as any, apiKeys);
          if (faqs.length > 0) {
            currentData.faqs = faqs;
            agent.log('polish', `✅ Generated ${faqs.length} FAQ pairs.`);
          }
        }
      } catch (e) {
        console.warn('FAQ Gen Error', e);
      }

      return currentData;
    });

    const finalData = polishedData;

    // 5. Verification
    await step.run('transition-gate-check', () => agent.transition('gate_check'));
    const verification = await step.run('verify-data', async () => {
      const { QualityGatekeeper } = await import('../../services/agents/QualityGatekeeper.js');
      return await QualityGatekeeper.validate(finalData as any, language);
    });

    // 6. DB Update
    const result = await step.run('finalize-db', async () => {
      return await agent.complete(verification, finalData);
    });

    // 7. Graph Population
    await step.run('populate-graph', async () => {
      try {
        const { GraphPopulator } = await import('../../services/ingestion/GraphPopulator.js');
        const graphResult = await GraphPopulator.populateFromResearch(
          item.id,
          finalData as any,
          jobId,
        );
        agent.log(
          'orchestrator',
          `📊 Graph populated: ${graphResult.entitiesCreated} entities, ${graphResult.edgesCreated} edges`,
        );
        return graphResult;
      } catch (e: any) {
        console.warn('[GraphPopulator] Error during population:', e);
        agent.log('system', `⚠️ Graph population skipped: ${e.message}`);
        return { entitiesCreated: 0, edgesCreated: 0 };
      }
    });

    return { success: true, ...result };
  },
);
