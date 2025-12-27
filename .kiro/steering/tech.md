# Technology Stack

## Frontend Framework
- **React 19.2.3** with TypeScript for modern component architecture
- **Vite 6.2.0** as build tool and development server
- **Lucide React** for consistent iconography

## Core Dependencies
- **@google/genai** - Gemini AI integration for content generation, analysis, and image recognition
- **papaparse** - CSV parsing for data import and export functionality
- **uuid** - Unique identifier generation for item tracking

## Development Tools
- **TypeScript 5.8.2** for comprehensive type safety
- **@vitejs/plugin-react** for React support in Vite
- **@types/node** for Node.js type definitions

## Build System & Commands

### Development
```bash
npm install        # Install dependencies
npm run dev        # Start development server on port 3000 (0.0.0.0)
```

### Production
```bash
npm run build      # Build for production
npm run preview    # Preview production build locally
```

## Environment Configuration
- Uses `.env.local` for environment variables
- **GEMINI_API_KEY** - Required for AI functionality (mapped to process.env.API_KEY)
- **FIRECRAWL_API_KEY** - Optional, stored in localStorage for web scraping capabilities

## Architecture Patterns

### Service Layer Architecture
- **geminiService.ts** - AI processing pipeline with search grounding, content synthesis, and image analysis
- **firecrawlService.ts** - Web scraping with v2 API support, autonomous agents, and rate limiting
- Clear separation between AI processing and data extraction services

### Component Architecture
- **Modular Components** - Clear separation of concerns with single responsibility
- **Type-First Development** - Comprehensive TypeScript interfaces in `types.ts`
- **Responsive Design** - Mobile-first approach with desktop enhancements
- **State Management** - Local React hooks with localStorage persistence

### Data Processing Pipeline
- **Queue-Based Processing** - Asynchronous item processing with status tracking
- **Real-time Updates** - Live status indicators and progress tracking
- **Error Handling** - Comprehensive error categorization and retry mechanisms
- **Audit Trail** - Complete source provenance and processing history

### External API Integration
- **Rate Limiting** - Exponential backoff and circuit breaker patterns
- **Error Recovery** - Graceful degradation and retry strategies
- **Source Validation** - Data quality checks and confidence scoring
- **Caching Strategy** - Intelligent caching to reduce API calls

## Data Storage & Persistence
- **LocalStorage** - Client-side persistence with versioned storage keys
- **JSON Serialization** - Structured data storage with type safety
- **Migration Support** - Version-aware data structure updates
- **Export Capabilities** - CSV export for external system integration

## Quality Assurance
- **Type Safety** - Comprehensive TypeScript coverage
- **Error Boundaries** - Graceful error handling in React components
- **Validation** - Input validation and data quality checks
- **Monitoring** - Processing metrics and quality indicators

## Deployment & Environment
- **AI Studio Integration** - Optimized for Google AI Studio deployment
- **Environment Variables** - Secure API key management
- **Build Optimization** - Vite-powered bundling and optimization
- **Cross-Platform** - Web-based with mobile responsiveness