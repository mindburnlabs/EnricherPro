# Repository Audit

## Overview

**Current State:** A sophisticated "Thick Client" Single Page Application (Vite + React + TypeScript) that performs agentic research entirely in the browser.
**Target State:** A "Perplexity Labs" style application with server-side orchestration (Inngest), persistent storage (Postgres), and scalable backend (Next.js/Node), while retaining the high-quality UI/UX.

## Current Stack

- **Framework:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS (with custom tokens)
- **State:** LocalStorage (`enricher_pro_db_v2`, `settings`) + React State
- **Logic:** `services/` folder contains complex business logic (Agents, API Integration, Resilience).
- **Agents:** `services/agents/` (Planner, Retriever, Extractor, Verifier) run in-browser.
- **APIs:** Direct calls to Firecrawl, Gemini (directly or via proxy?).
- **Testing:** Vitest.

## Gap Analysis

| Feature            | Current Implementation            | Target Requirement                 | Gap Status          |
| :----------------- | :-------------------------------- | :--------------------------------- | :------------------ |
| **Architecture**   | Client-Side SPA (Vite)            | Full Stack (Next.js / Vercel API)  | 🔴 **CRITICAL**     |
| **Orchestration**  | Promise Chains / Async            | Inngest / Temporal                 | 🔴 **CRITICAL**     |
| **Database**       | LocalStorage                      | Postgres (Neon/Supabase)           | 🔴 **CRITICAL**     |
| **Heavy Jobs**     | Browser-blocking                  | Server-side Workers                | 🔴 **CRITICAL**     |
| **Search/Extract** | Firecrawl (in-browser)            | Firecrawl (server-side w/ caching) | 🟡 High             |
| **LLM Gateway**    | Gemini Direct                     | OpenRouter (Unified Gateway)       | 🟡 High             |
| **Data/Schema**    | `StrictConsumableData`            | Same + Postgres Relations          | 🟢 Good             |
| **UI/UX**          | High Quality, Research Cards      | Perplexity "Run View" + Streaming  | 🟡 Needs Adaptation |
| **Conflict UI**    | Basic                             | Interactive "Why X?" + Overrides   | 🟡 Needs Work       |
| **Deduplication**  | None / Manual                     | Automated + Merit-based Merge      | 🔴 Missing          |
| **Rate Limiting**  | In-memory `ApiIntegrationService` | Redis + Durable                    | 🟡 Needs Migration  |

## Key Risks

1.  **Browser Limits:** Content Security Policy (CSP) and CORS issues with direct API calls (e.g. Firecrawl, LLMs) if not handled via proxy.
2.  **State Loss:** LocalStorage is not durable for "Deep Research" that takes minutes. Refreshing loses progress.
3.  **Secret Management:** API keys currently stored in browser `localStorage` or `.env`. Needs server-side security.

## Assets

- **Strong Foundation:** `apiIntegrationService.ts` is robust.
- **Good Types:** `types/domain.ts` is solid.
- **Agent Logic:** `services/agents/` provides a great logical starting point to port to Inngest.
