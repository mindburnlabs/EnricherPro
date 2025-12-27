# Consumable Enricher Pro

**Automated enrichment of printer consumable data using AI and comprehensive validation**

A React-based web application that transforms supplier product titles into structured, enriched consumable cards for printing supplies. The system follows strict Russian market requirements and implements comprehensive data validation with complete audit trails.

## 🎯 Key Features

- **Automated Data Processing**: Transform supplier titles into structured consumable data
- **Russian Market Compliance**: Strict 2+ source verification for printer compatibility
- **Comprehensive Validation**: Package dimensions, weight, and image validation
- **AI-Powered Research**: Gemini AI with Search Grounding for autonomous product research
- **Web Scraping Integration**: Firecrawl v2 API for data extraction from trusted sources
- **Complete Audit Trail**: Full source provenance and processing history
- **Publication Readiness**: Automated quality scoring and readiness evaluation
- **Batch Processing**: Queue-based processing with real-time status updates
- **Export Functionality**: CSV export with enhanced data fields

## 🏗️ Architecture

### Frontend Framework
- **React 19.2.3** with TypeScript for modern component architecture
- **Vite 6.2.0** as build tool and development server
- **Lucide React** for consistent iconography

### Core Dependencies
- **@google/genai** - Gemini AI integration for content generation and analysis
- **papaparse** - CSV parsing for data import and export functionality
- **uuid** - Unique identifier generation for item tracking

### Service Layer Architecture
- **geminiService.ts** - AI processing pipeline with search grounding and content synthesis
- **firecrawlService.ts** - Web scraping with v2 API support and rate limiting
- **nixService.ts** - Exclusive NIX.ru integration for package dimensions and weight
- **russianMarketFilter.ts** - Russian market compliance and printer verification
- **publicationReadinessService.ts** - Quality scoring and publication readiness evaluation
- **auditTrailService.ts** - Complete audit trail and source provenance tracking

## 🚀 Quick Start

### Prerequisites
- Node.js (latest LTS version)
- Gemini API key from Google AI Studio

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd consumable-enricher-pro
   npm install
   ```

2. **Configure environment variables:**
   Create `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:5173`

### Production Build

```bash
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## 🧪 Testing

The project includes comprehensive test suites:

```bash
npm test         # Run all tests once
npm run test:watch  # Run tests in watch mode
npm run test:ui     # Run tests with UI interface
```

### Test Coverage
- **Property-based tests** with fast-check for robust validation
- **Integration tests** for complete pipeline validation
- **Russian market compliance tests** for regulatory requirements
- **End-to-end tests** for complete workflow validation

## 📊 Data Processing Pipeline

### Input Processing
1. **Text Normalization** - Unicode cleanup, pattern standardization
2. **Model Extraction** - Pattern matching for consumable models
3. **Brand Detection** - Brand identification from title or model patterns
4. **Type Classification** - Consumable type determination

### External Enrichment
1. **NIX.ru Integration** - Package dimensions and weight (mandatory source)
2. **Compatibility Research** - Printer compatibility from multiple sources
3. **Russian Market Filtering** - Printer eligibility verification
4. **Image Validation** - Quality and content validation
5. **Related Items Discovery** - Compatible consumables identification

### Quality Assurance
- **Confidence Scoring** - Multi-dimensional quality assessment
- **Source Provenance** - Complete audit trail maintenance
- **Publication Readiness** - Automated quality scoring
- **Error Handling** - Comprehensive error categorization and retry logic

## 🌍 Russian Market Compliance

The system implements strict Russian market requirements:

- **2+ Source Verification**: Printers must be verified in ≥2 Russian sources
- **Trusted Sources**: cartridge.ru, rashodnika.net, OEM Russian distributors
- **Separate Storage**: Unverified printers stored separately
- **Quality Metrics**: Confidence scoring and verification rates
- **Official Prioritization**: Russian distributor sources prioritized

## 🔧 Configuration

### API Integration
- **Gemini AI**: Content generation, image analysis, search grounding
- **Firecrawl v2**: Web scraping with autonomous research agents
- **NIX.ru**: Package dimensions and weight (exclusive source)

### Data Sources
- **Primary Logistics**: NIX.ru (mandatory for package data)
- **Compatibility**: cartridge.ru, rashodnika.net, OEM websites
- **Image Sources**: Approved library with quality validation

## 📈 Monitoring & Quality

### Processing Metrics
- Success rate tracking (target >95%)
- Average processing time monitoring
- Source availability monitoring
- Error categorization and trending

### Quality Indicators
- Data completeness scoring
- Source reliability assessment
- Validation pass rates
- Audit trail completeness

## 🔒 Security & Compliance

- **API Key Management** - Secure environment variable handling
- **Data Validation** - Comprehensive input validation
- **Error Handling** - Graceful degradation and retry strategies
- **Audit Trail** - Complete processing history and source tracking

## 📚 Documentation

- [Complete Specification](complete_specification.md) - Detailed technical requirements
- [Test Summary](test-summary-final-checkpoint.md) - Comprehensive test results
- [Checkpoint Summary](checkpoint-summary.md) - Core validation results

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is private and proprietary.

---

**View in AI Studio**: https://ai.studio/apps/drive/1JvSaD8Xl7dWiKbMqzeO02tpCwiwKSI4f
