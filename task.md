# Task List: Enricher Labs Migration

## Phase 1: Audit & Plan ✅
- [x] Audit Repo & Create `AUDIT.md`
- [x] Define UX in `PRD_UX.md`
- [x] Define Architecture in `ARCHITECTURE.md`
- [x] Create `BACKLOG.md` & `IMPLEMENTATION_PLAN.md`

## Phase 2: Implementation (PR Packages)

### Package 1: DB Schema & Migrations 🚀
- [x] Install Drizzle ORM, PG, Dotenv
- [x] Create `src/db/schema.ts` (Jobs, Items, Evidence tables)
- [x] Create `drizzle.config.ts`
- [x] Generate initial migration (SQL)
- [x] Verify DB connection script (Re-verified after schema sync)

### Package 2: Evidence Store & Repositories
- [x] Create `src/repositories/itemsRepository.ts`
- [x] Create `src/repositories/evidenceRepository.ts`
- [x] Implement `StrictConsumableData` <-> DB Transformers
- [x] Unit Tests for Repositories

### Package 3: Inngest Orchestration
- [x] Install Inngest SDK
- [x] Create `api/inngest/route.ts` (Webhook)
- [x] Define Event Schema (`src/lib/events.ts`)
- [x] Create "Research Workflow" Skeleton function

### Package 4: Backend Services (Firecrawl/OpenRouter)
- [x] Implement Server-side Firecrawl Client
- [x] Implement Server-side OpenRouter Client
- [x] Add caching/rate-limiting logic (Basic implementation via service wrapper)

### Package 5: Migration of Agents
- [x] Port `PlannerAgent` to Server logic
- [x] Port `ExtractorAgent` to Server logic
- [x] Port `VerifierAgent` to Server logic

### Package 6: Perplexity UI
- [x] Build `ResearchComposer` (Input)
- [x] Build `RunProgress` (Streaming View)
- [x] Build `CitationDrawer` & `ReviewQueue`
- [x] Integrate App with Backend API

## Phase 3: Verification & Launch
- [x] Full End-to-End Test (Unit Tests + Build + DB Verify passed)
- [x] Documentation Update (`SETUP.md`, `DEPLOY.md`)
