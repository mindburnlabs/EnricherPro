# i18n Audit Report

## 1. Overview
The project currently has a partial i18n setup (`react-i18next`, `i18n/config.ts`, `ru.json`), but the vast majority of user-facing text is hardcoded in English within the components.

**Status:**
- **Infrastructure:** Exists (`src/i18n`) but is minimal.
- **Coverage:** estimated < 10% (mostly `SettingsView`).
- **Core Flows:** Completely hardcoded (Composer, Results, Detail View, Research Progress).

## 2. Hardcoded Strings Categories

### Core UI
- **Buttons:** "Run Enrichment Agent", "Approve", "Merge", "Retry" (implied).
- **Navigation/Headers:** "No relational data identified in this run", "Initializing Agent...".
- **Empty States:** Various text in `DetailView` and `ResultCard`.

### Domain Terms (Glossary Candidates)
- **Entities:** "Agent", "Enrichment", "Conflict Resolution", "Relational Data".
- **Fields:** `input_raw`, `model`, `uri`.
- **Review:** "Review reasons", "Unknown".

### Statuses
- **Workflow:** "Pending", "Running", "Completed", "Failed".
- **Internal:** "Initializing Agent...", "Running conflict resolution logic...".

## 3. i18n Violations Identified

### Hardcoded JSX
Hundreds of instances of direct English text in render methods:
- `components/ImportView.tsx`: `<Play ... /> Run Enrichment Agent`
- `components/StatusBadge.tsx`: `Pending`
- `components/DetailView.tsx`: `No relational data identified in this run`

### String Concatenation & Interpolation
- `components/Research/ReviewQueue.tsx`: `Review reasons: {item.data.reviewReason || 'Unknown'}`
- Likely issues with plurals (not explicitly seen in grep but typical in this state).

### Dates & Numbers
- No evidence of `Intl.NumberFormat` or `Intl.DateTimeFormat` usage in scanned snippets.
- Raw display of values like `{g.uri}` or `{rel.model}` which might need localization or at least consistent formatting.

### Missing Plurals
- "Review reasons" implies potentially multiple reasons, handled as a string.
- Search patterns suggest simple string rendering without plural logic (e.g. "X items found").

## 4. Proposed Glossary (RU)

| Key Term | Russian Translation | Notes |
| :--- | :--- | :--- |
| Enrichment Agent | Агент обогащения | |
| Conflict Resolution | Разрешение конфликтов | |
| Needs Review | Требует проверки | |
| Pending | В очереди | |
| Running | Выполняется | |
| Failed | Ошибка | |
| Source | Источник | |
| Evidence | Доказательство | |
| Compatibility | Совместимость | |
| SKU | Артикул / SKU | Context dependent |
| Toner Cartridge | Тонер-картридж | |

## 5. Next Steps
1.  **Extract Strings**: Systematically replace hardcoded strings with `t('key')`.
2.  **Structuring**: Create `src/i18n/ru/` with split files (`common.json`, `research.json`, `statuses.json`).
3.  **Refactor**: Modify components to use `useTranslation`.
