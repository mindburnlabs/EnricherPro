# D² (Deep Discovery) v3.0 🚀

> **The State-of-the-Art Autonomous Research Engine**

**D² (Deep Discovery)** is an advanced agentic AI system designed for high-precision, "Evidence-First" data enrichment. Unlike traditional scrapers, it uses a multi-agent swarm to autonomously plan, navigate, and verify information across the deep web, strictly adhering to a "No Hallucination" policy.

![Status](https://img.shields.io/badge/Status-Production_Ready-green)
![Version](https://img.shields.io/badge/Version-3.0.0-blue)
![Stack](https://img.shields.io/badge/Stack-Firecrawl_v2_|_Neon_|_Inngest-violet)

## ✨ Key Capabilities

-   **🔎 Autonomous Deep Web Agents**: A swarm of specialized agents (Discovery, Enrichment, Logistics) that navigate websites like human analysts.
-   **💎 Input Grounding**: Treats user feedback as the "Golden Source" of truth, preventing "Unknown" fields when the user provides data.
-   **🕷️ Firecrawl v2 Native**: Built on the latest Firecrawl SDK with support for **Deep Crawl**, **Map**, **Interactive Actions**, and **Batch Scrape**.
-   **🛡️ Evidence-First Architecture**: Every data point is backed by a specific source URL and confidence score. Zero-trust verification.
-   **🧠 High-Fidelity Extraction**: Extracts deep fields including **Short Models** (Aliases), **FAQs**, **Related Products**, and **Tech Specs** (Chips, Counters).
-   **⚖️ Truth Settlement**: A deterministic "Quorum & Truth" resolution engine that arbitrates between conflicting data sources (e.g., OEM vs Marketplace).
-   **⚡ Frontier Exploration Loop**: A parallelized graph traversal focused on high-recall discovery of hidden specs.
-   **🌍 Multi-Lingual Native**: Full `i18n` support (UI & prompts) for English and Russian (`ru`, `en`), with locale-specific search strategies.
-   **🔄 Global Analyst Loop**: Iterative re-planning that continues until specific "Knowledge Gaps" are filled.
-   **⚡ Vertical Search (Graph-Lite)**: Local knowledge graph optimized for deterministic lookups and immediate hits, bypassing web search for known entities.
-   **🧠 Dynamic Model Routing**: Auto-generated model configuration strategies using live pricing and capability data from OpenRouter.

## 🏗️ Architecture

The system follows a durable execution model using **Inngest** for reliable, long-running agent workflows:

```mermaid
graph TD
    User[User Input] --> API[Next.js API]
    API --> Inngest[Inngest Event Bus]
    Inngest --> Workflow[Research Workflow]
    
    subgraph "Agentic Engine (D²)"
        Workflow --> Planning[Discovery Agent (Strategic Plan)]
        Planning --> Frontier[Frontier Loop]
        
        Frontier --> Firecrawl[Firecrawl v2 (Crawl/Map/Agent)]
        Frontier --> Extraction[LLM Extraction (Strict JSON)]
        
        Frontier --> Validation[Quality Gatekeeper]
        Validation --> Truth[Truth & Quorum]
    end
    
    Truth --> DB[(Neon PostgreSQL)]
    DB --> UI[React Frontend (Streaming)]
```

## 🚀 Getting Started

### Prerequisites

-   Node.js 18+
-   PostgreSQL (Neon.tech recommended)
-   **Firecrawl API Key** (Critical for v2 Agents)
-   **OpenRouter / Gemini Key** (For heavy reasoning)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mindburnlabs/unique-enricher.git
    cd enricher-pro
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # Ensure Firecrawl SDK is v2 compat
    npm list @mendable/firecrawl-js
    ```

3.  **Configure Environment:**
    Copy `.env.example` to `.env.local` and populate keys:
    ```bash
    cp .env.example .env.local
    ```
    *Required*: `FIRECRAWL_API_KEY`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `INNGEST_EVENT_KEY`.

4.  **Initialize Database:**
    ```bash
    npx drizzle-kit push
    ```

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```

6.  **Update Model Configs:**
    The system uses a dynamic model selector. To refresh model lists from OpenRouter:
    ```bash
    npm run gen:models
    ```

## 🛠️ Operational Guide

### Firecrawl v2 Integration
D² uses the strict v2 SDK. The `BackendFirecrawlService` handles:
-   **Map**: High-recall URL discovery.
-   **Crawl**: Recursive deep indexing with `maxDiscoveryDepth`.
-   **Agent**: Autonomous navigation for complex interaction.
-   **Batch Scrape**: High-throughput validation.

### Localization
The system auto-detects locale but favors `en` for technical specs. Modify `src/i18n/config.ts` to add supported languages.

## 🧪 Testing

Run the rigorous agent verification suite:

```bash
npm test
```

## 📜 License

Proprietary & Confidential. Mindburn Labs.
