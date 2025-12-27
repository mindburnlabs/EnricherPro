# Project Structure

## Root Files
- `App.tsx` - Main application component with state management, queue processing, and routing logic
- `index.tsx` - React application entry point
- `index.html` - HTML template
- `types.ts` - Comprehensive TypeScript type definitions for the entire application
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite configuration with environment variable handling
- `tsconfig.json` - TypeScript compiler configuration
- `metadata.json` - Application metadata for AI Studio deployment

## Components Directory (`/components`)
All React components follow PascalCase naming:

- `Layout.tsx` - Main layout wrapper with navigation, sidebar, and service status indicators
- `ImportView.tsx` - Data import interface for consumable identifiers (text input + photo recognition)
- `ResultsView.tsx` - Display enriched items with filtering, search, and export capabilities
- `DetailView.tsx` - Comprehensive detailed view with tabbed interface for specs, evidence, thinking process, images, and FAQ
- `SettingsView.tsx` - Configuration interface for API keys with validation
- `StatusBadge.tsx` - Reusable status indicator component with processing step details

## Services Directory (`/services`)
External API integrations and business logic:

- `geminiService.ts` - Gemini AI integration for content generation, analysis, and image recognition
- `firecrawlService.ts` - Firecrawl v2 API integration for web scraping and autonomous research
- `mockFirecrawl.ts` - Deprecated mock service (removed in favor of live integration)

## Data Architecture

### Core Data Types
- `EnrichedItem` - Complete enriched consumable record with metadata
- `ConsumableData` - Structured product data (brand, model, compatibility, etc.)
- `ValidationStatus` - Processing status tracking (`pending`, `processing`, `ok`, `needs_review`, `failed`)
- `ProcessingStep` - Detailed step tracking (`searching`, `scraping_nix`, `analyzing`, etc.)
- `EvidenceBlock` - Source provenance and audit trail
- `ImageCandidate` - Image validation with quality scoring

### Processing Pipeline
1. **Input Normalization** - Unicode cleanup, pattern standardization
2. **Model Extraction** - Pattern matching for consumable models
3. **Brand Detection** - Brand identification from title or model patterns
4. **Type Classification** - Consumable type determination
5. **External Enrichment** - Data fetching from nix.ru, compatibility databases
6. **Russian Market Filtering** - Printer eligibility verification
7. **Image Validation** - Quality and content validation
8. **Related Items Discovery** - Compatible consumables identification

## Naming Conventions
- **Files**: PascalCase for components, camelCase for services
- **Types**: PascalCase interfaces, camelCase for properties
- **Constants**: UPPER_SNAKE_CASE (e.g., `STORAGE_KEY`)
- **Functions**: camelCase with descriptive names
- **Processing Steps**: snake_case for consistency with backend systems

## State Management
- Local component state using React hooks
- LocalStorage persistence with versioned storage key (`enricher_pro_db_v2`)
- Queue-based processing with real-time status updates
- No external state management library (Redux, Zustand) used
- Event-driven updates for cross-component communication

## Data Flow
1. **Import** → Text input or photo recognition → Queue
2. **Processing** → AI research → External API calls → Data synthesis
3. **Validation** → Quality checks → Russian market filtering → Image validation
4. **Storage** → LocalStorage persistence → Status updates
5. **Display** → Filtered results → Detailed views → Export capabilities

## External Integrations
- **Gemini AI** - Content generation, image analysis, search grounding
- **Firecrawl v2** - Web scraping, autonomous research agents
- **nix.ru** - Package dimensions and weight (mandatory source)
- **cartridge.ru, rashodnika.net** - Printer compatibility data
- **OEM websites** - Official product specifications