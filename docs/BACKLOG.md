# Backlog & P0 Roadmap

## Phase Setup (Current)
- [x] Audit Existing Codebase
- [x] Define Target Architecture
- [x] Create PRD

## Implementation Packages (P0)

### Package 1: Infrastructure Foundations
- **Goal:** Set up Next.js (or adapt Vite + API), Postgres, and Inngest skeleton.
- **Tasks:**
    - [x] Initialize `drizzle` (or Prisma) + Postgres schema.
    - [x] Create `schema.prisma` / `schema.ts`.
    - [x] Set up Inngest SDK & Dev Server.
    - [x] Create basic `Hello World` Inngest function.

### Package 2: Core Data Layer
- **Goal:** Port `StrictConsumableData` to DB and Repository pattern.
- **Tasks:**
    - [x] Migrate `types/domain.ts` types to DB schema.
    - [x] Create repositories (`ItemsRepository`, `SourcesRepository`).
    - [x] Implement `EvidenceStore` (JSONB implementation for storing raw crawl data).

### Package 3: Orchestration Skeleton
- **Goal:** Move `orchestrationService.ts` logic to Inngest.
- **Tasks:**
    - [x] Create `workflows/research.ts` (Inngest function).
    - [x] Port `Planner` logic to server-side step.
    - [x] Implement SSE / Polling endpoint for frontend to see progress.

### Package 4: External Integrations (Firecrawl & OpenRouter)
- **Goal:** Server-side reliable execution.
- **Tasks:**
    - [x] Port `firecrawlService.ts` to server (handle API keys securely).
    - [x] Create `OpenRouterService` (Unified LLM Client).
    - [x] Implement Rate Limiting (Redis) for domain niceness.

### Package 5: The "Perplexity" UI
- **Goal:** Interactive Run View.
- **Tasks:**
    - [x] Build `RunProgress` component (streaming steps).
    - [x] Build `CitationDrawer` (slide-out evidence).
    - [x] Update `ResultCard` to support field-level conflict states.

### Package 6: Quality Gates & Dedupe
- **Goal:** The "5% Review" target.
- **Tasks:**
    - [x] Implement `VerifierAgent` logic in Inngest.
    - [x] Build `ReviewQueue` UI (swiping/approving conflicts).
    - [x] Implement Deduplication logic (merging items).

## Dependencies & Risks
- **External:** Needs Firecrawl API Key, OpenRouter Key, Postgres URL.
- **Migration:** Existing LocalStorage data needs a migration plan (or just wipe for MVP).
