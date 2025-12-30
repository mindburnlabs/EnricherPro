# Walkthrough: Enricher Labs Transformation

We have successfully transformed the client-side "EnricherPro" into "Enricher Labs" – a server-orchestrated, deep research agent platform.

## 1. Architecture Shift
- **Frontend:** Retained Vite/React but moved to a "Perplexity-style" single input interface (`ResearchComposer`).
- **Backend:** Introduced Vercel Serverless Functions (`api/inngest`) for orchestration.
- **Database:** Added Postgres (Neon) + Drizzle ORM for persistent storage of Jobs, Items, and Evidence.
- **Orchestration:** Implemented Inngest for durable, multi-step agent workflows (`Planner` -> `Search` -> `Extract` -> `Verify`).

## 2. New Capabilities
- **Durable Research:** Jobs run on the server, so you can close the browser tab and progress is saved.
- **Secure Execution:** API keys (Firecrawl, OpenRouter) are hidden on the server.
- **Structured Evidence:** All data is stored with granular citations (`evidence` table).

## 3. Key Components
- **`ResearchComposer`**: A smart input field that accepts SKUs or semantic queries.
- **`RunProgress`**: A streaming side-panel showing real-time agent steps.
- **`ReviewQueue`**: A dedicated UI for resolving data conflicts (needs_review items).
- **`Repositories`**: `ItemsRepository` and `EvidenceRepository` abstracting the DB layer.

## 4. Verification
- **Database:** Verified connection and schema push to Neon.
- **Logic:** Unit tests passed for Repositories.
- **Build:** `npm run build` passes with the new UI integration.

## 5. Next Steps
- Deploy to Vercel.
- Configure Inngest Cloud.
- Implement specialized extractors for more domains.
