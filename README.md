# Consumable Enricher Pro 🚀

> **The State-of-the-Art Consumables Database Enrichment System**

Enricher Pro is an agentic AI system designed to autonomously research, verify, and enrich printer consumable data (toners, cartridges) with high precision (99%+ target). It leverages a multi-agent architecture to cross-reference data from official manufacturer sites and trusted marketplaces like NIX.ru.

![Status](https://img.shields.io/badge/Status-Production_Ready-green)
![Tech](https://img.shields.io/badge/Stack-React_|_Node.js_|_Inngest-blue)

## ✨ Key Features

-   **Autonomous Research Agents**: A swarm of specialized AI agents (Discovery, Logistics, Synthesis) orchestrate the research process.
-   **Multi-Source Verification**: cross-references official datasheets with marketplace data to ensure accuracy.
-   **NIX.ru Logistics Integration**: Specifically targets verified weight and dimension data from NIX.ru.
-   **Quality Gatekeeper**: A strict 5-stage validation pipeline ensures only complete and consistent data is published.
-   **Real-time Streaming**: Live research progress updates via Server-Sent Events (SSE).
-   **Batch Processing**: Queue hundreds of SKUs for background enrichment.
-   **Dynamic Configuration**: BYOK (Bring Your Own Key) support for Firecrawl, OpenRouter, and Google Gemini via the UI.

## 🏗️ Architecture

The system follows a durable execution model using **Inngest**:

```mermaid
graph TD
    User[User Input] --> API[Next.js API]
    API --> Inngest[Inngest Event Bus]
    Inngest --> Workflow[Research Workflow]
    
    subgraph Agents
        Workflow --> Planning[Discovery Agent (Plan)]
        Workflow --> Execution[Discovery Agent (Execute)]
        Execution --> Firecrawl[Firecrawl Search]
        Workflow --> Logistics[Logistics Agent (NIX.ru)]
        Workflow --> Synthesis[Synthesis Agent (LLM Merge)]
        Workflow --> Gatekeeper[Quality Gatekeeper (Validation)]
    end
    
    Gatekeeper --> DB[(PostgreSQL DB)]
    DB --> UI[React Frontend]
```

## 🚀 Getting Started

### Prerequisites

-   Node.js 18+
-   PostgreSQL (Neon.tech recommended)
-   API Keys:
    -   **Firecrawl** (for web search)
    -   **OpenRouter / Google Gemini** (for LLM reasoning)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-org/enricher-pro.git
    cd enricher-pro
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Copy `.env.local.example` to `.env.local`:
    ```bash
    cp .env.local.example .env.local
    ```
    Fill in your database URL and default API keys.

4.  **Initialize Database:**
    ```bash
    npx drizzle-kit push
    ```

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```

### 🌍 BYOK (Bring Your Own Key)

You can configure API keys directly in the **Settings** UI (Top right gear icon). These keys are stored in your browser's `localStorage` and passed securely to the backend for each request, overriding the server defaults.

## 🛠️ Operational Guide

See [docs/operations.md](docs/operations.md) for detailed deployment, monitoring, and troubleshooting instructions.

## 🧪 Testing

Run the test suite to verify agent logic:

```bash
npm test
```

## 📜 License

Private / Proprietary.
