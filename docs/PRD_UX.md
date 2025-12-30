# PRD & UX Specification: "Enricher Labs"

**Vision:** A "Perplexity for Cartridges" – an intelligent, autonomous research agent that builds the perfect SKU spec sheet from scattered web data.

## 1. Core Experience (The "Hero" Loop)

### 1.1 The Input (Omni-Bar)
- **Interface:** A clean, large input area (like Perplexity/Claude).
- **Capabilities:**
    - Paste a messy Excel row: `HP W1331A 331A black toner`
    - Paste a part number: `DK-7105`
    - Paste a vague query: `Compatible toners for Kyocera ECOSYS P3145dn`
- **Immediate Action:** System parses intent, identifying "Target Item" vs "Context".

### 1.2 The Plan (Transparency)
- **Status Card:** "Planning Research..."
- **Plan Display:** Shows the user what it will do BEFORE doing it (or streaming as it starts).
    - "Searching NIX.ru for packaging dims..."
    - "Checking Manufacturer site for yield..."
    - "Verifying compatibility on retailer sites..."

### 1.3 The Run (Streaming Execution)
- **Perplexity-Style Left Side:**
    - **Steps:** Scrolling log of actions (`Found 3 sources`, `Extracting specs`, `Conflict detected`).
    - **Artifacts:** Mini-cards showing retrieved images or snippets as they appear.
- **Right Side (The Draft):**
    - A "Live SKU Card" that fills in dynamically.
    - Fields start grey/skeleton -> flash yellow (retrieving) -> turn solid (confirmed).

### 1.4 The Review (Human-in-the-Loop)
- **Conflict Handling:**
    - If Source A says "200g" and Source B says "210g", the field highlights orange.
    - **Clicking** opens a drawer: "Source A (Official) vs Source B (Retailer). AI chose A because reliable."
    - User can override with one click.
- **Missing Data:**
    - "Why missing?" tooltip: "Checked 15 sites, no weight found."
    - **Action:** "Ask 1 question" button (triggers specific new search) or "Manual Entry".

## 2. Functional Requirements

### 2.1 Research Agent
- **Orchestration:** Multi-step workflow (Planner -> Search -> Extract -> Verify).
- **Tools:**
    - `Firecrawl` (Search & Extract).
    - `OpenRouter` (LLM Reasoning).
- **Logic:**
    - **Whitelist First:** Prioritize `nix.ru`, `dns-shop.ru`, `komus.ru` (verified retailers).
    - **Evidence Binding:** Every field MUST have a `source_url` and `text_snippet`.

### 2.2 Data Quality
- **Review Queue:** Items with <95% confidence or unresolvable conflicts go to "Needs Review".
- **Strict Schema:** `StrictConsumableData` (from codebase) is the law.
- **Deduplication:** Auto-detect if `W1331A` and `HP 331A` are the same item.

## 3. Technical Constraints
- **Response Time:** Initial response < 2s. Full research < 3 mins.
- **Concurrency:** Support batch processing (user pastes 50 rows).
- **Reliability:** Resume-able runs (if browser closes, job continues on server).
