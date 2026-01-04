# Implementation Plan: EnricherPro -> Enricher Labs (v2)

**Goal:** Transform the client-side "EnricherPro" into a robust, server-side orchestrated "Enricher Labs" (Perplexity-style) application. The goal is to achieve 0% data loss, durable "Deep Research" execution, and a "State-of-the-Art" UX.

## User Review Required

> [!IMPORTANT]
> **Architecture Shift:** We are introducing a **Vercel Serverless Function** layer (`/api`) to the existing Vite project. This allows us to keep the existing React frontend while adding backend capabilities.
> **Database:** We assume a Postgres connection string (`DATABASE_URL`) will be available.
> **Orchestration:** We are adding `inngest` as a dependency. You will need to run `npx inngest-cli@latest dev` locally.

---

## Proposed Changes (PR Packages)

### Package 1: DB Schema & Migrations

**Goal:** Establish the persistent memory for the application.

- **Stack:** Drizzle ORM + Postgres (Neon/Supabase compatible).
- **Files:**
  - `[NEW] src/db/schema.ts`: Define `jobs`, `items`, `evidence`, `sources` tables.
  - `[NEW] src/db/index.ts`: DB Connection logic.
  - `[NEW] src/db/migrations/*`: SQL migration files.
  - `[MODIFY] package.json`: Add `drizzle-orm`, `pg`, `dotenv`.
- **Verification:**
  - Run `npm run db:push`.
  - Verify tables exist in local/remote DB.

### Package 2: Evidence Store & Repository Layer

**Goal:** Abstract DB access and map `StrictConsumableData` to relational tables.

- **Files:**
  - `[NEW] src/repositories/itemsRepository.ts`: CRUD for research items.
  - `[NEW] src/repositories/evidenceRepository.ts`: CRUD for citations/sources.
  - `[NEW] src/lib/transformers.ts`: Convert DB rows <-> Domain Types (`ConsumableData`).
- **Verification:**
  - Unit tests: `tests/repositories.test.ts`.
  - Create an item, save it, retrieve it, verify data integrity.

### Package 3: Inngest Skeleton & Realtime Protocol

**Goal:** Set up the "Brain" (Orchestrator) and the nervous system (Events).

- **Files:**
  - `[NEW] api/inngest/route.ts`: The Inngest webhook handler (Vercel function).
  - `[NEW] src/inngest/client.ts`: Inngest client initialization.
  - `[NEW] src/inngest/functions/researchWorkflow.ts`: The "Shell" workflow (steps: Start -> Plan -> Search -> Finish).
  - `[NEW] src/lib/events.ts`: Typed event definitions (`app/research.started`, `app/research.completed`).
- **Verification:**
  - Run Inngest Dev Server.
  - Trigger a test event via Curl.
  - Verify the workflow runs in the local Inngest dashboard.

### Package 4: Firecrawl Connector (Search & Extract)

**Goal:** Server-side, confident search and extraction with caching.

- **Files:**
  - `[NEW] src/services/backend/firecrawl.ts`: Server-side Firecrawl client (hides API key).
  - `[NEW] src/actions/search.ts`: Server action or API route to trigger search.
  - `[MODIFY] src/services/backend/firecrawl.ts`: Implement specific `searchNix`, `searchCompetitors` methods.
- **Verification:**
  - Integration test: `npx tsx tests/backend/firecrawl.test.ts`.
  - Verify it returns valid JSON and handles rate limits.

### Package 5: OpenRouter Connector & Agents

**Goal:** The "Mind" - migrating agent logic to server-side serverless functions.

- **Files:**
  - `[NEW] src/services/backend/llm.ts`: OpenRouter client with "Model Escalation" (Flash -> Pro).
  - `[MOVED/REFAC] src/inngest/steps/planner.ts`: Port `PlannerAgent` output to Inngest step.
  - `[MOVED/REFAC] src/inngest/steps/extractor.ts`: Port `ExtractorAgent` to use pure server-side LLM calls.
  - `[MOVED/REFAC] src/inngest/steps/verifier.ts`: Port `VerifierAgent` logic.
- **Verification:**
  - Run a full "Deep Research" simulation via script.
  - Verify cost tracking and model fallback logic.

### Package 6: Perplexity UI (The Face)

**Goal:** Connect the frontend to the new backend brain.

- **Files:**
  - `[MODIFY] src/App.tsx`: Integrate `ResearchComposer` (new input).
  - `[NEW] src/components/Research/RunProgress.tsx`: Streaming step-by-step view.
  - `[NEW] src/components/Research/CitationDrawer.tsx`: Slide-out evidence.
  - `[NEW] src/components/Research/ReviewQueue.tsx`: Conflict resolution UI.
- **Verification:**
  - User flow: Submit SKU -> See Live Progress -> Review Result -> Approve.

---

## Verification Plan

### Automated Tests

- **Unit Tests:** `vitest` for all new repositories and utility functions.
- **Integration Tests:** New folder `tests/backend/` for verifying Firecrawl/LLM/DB interactions (will use mocks for CI).

### Manual Verification

- **"The Trace":** For every run, we will inspect the Inngest logs to ensure the logic was executed as expected.
- **"The Dashboard":** We effectively build the "Perplexity Labs" UI as our main verification tool.
