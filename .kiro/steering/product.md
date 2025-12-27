---
inclusion: always
---

# Product Context: Consumable Enricher Pro

**Consumable Enricher Pro** is a React-based web application that automatically transforms supplier product titles into structured, enriched consumable cards for printing supplies. The system follows strict Russian market requirements and implements comprehensive data validation.

## Business Domain Rules

### Data Processing Pipeline
- Items flow through: Import → Parse → Enrich → Validate → Output
- Each item has status: `pending`, `processing`, `ok`, `needs_review`, `failed`
- Failed items should be retryable with clear error messaging
- Processing is asynchronous with real-time status updates
- Manual review queue for items requiring human intervention

### Core Data Requirements (Russian Market Focus)
- **Consumable Identifiers**: Exact manufacturer part numbers (MPNs), model aliases
- **Technical Specifications**: Package dimensions (mm), weight (g), page yield, color
- **Russian Market Compatibility**: Only printers verified for Russian/CIS market
- **Logistics Data**: Mandatory package dimensions and weight from nix.ru
- **Image Validation**: Strict quality requirements (800x800px, white background, no watermarks)
- **Related Products**: Compatible consumables for the same printers

### Data Sources and Validation Rules
- **Primary Logistics Source**: nix.ru (mandatory for package dimensions/weight)
- **Compatibility Sources**: cartridge.ru, rashodnika.net, OEM websites
- **Russian Market Filter**: Printers must be verified in ≥2 Russian sources
- **Image Sources**: Approved library only or supplier with moderation
- **Round-trip Validation**: All parsers must support parse→print→parse consistency

### Processing Status and Error Handling
- **Automation Status**: `done`, `needs_review`, `failed`
- **Failure Categories**: 
  - `failed_parse_model`: Cannot extract consumable model
  - `missing_nix_dimensions_weight`: No package data from nix.ru
  - `compatibility_conflict`: Conflicting compatibility sources
  - `ru_eligibility_unknown`: Cannot verify Russian market eligibility
  - `missing_valid_image`: No image meeting quality standards

### Publication Readiness Criteria
- All required fields populated and validated
- Package dimensions from nix.ru with correct unit conversion
- Compatible printers verified for Russian market
- Related consumables generated
- Image passes all validation checks
- Complete audit trail with source provenance

## AI Integration Patterns

### Gemini AI Integration
- **Search Grounding**: Use Google Search for autonomous product research
- **Content Generation**: Structured data extraction with confidence scoring
- **Image Analysis**: OCR and content validation for product images
- **Thinking Process**: Maintain reasoning logs for transparency

### Firecrawl Integration
- **Web Scraping**: Extract data from nix.ru, compatibility databases
- **Autonomous Agent**: Deep research when primary sources unavailable
- **Rate Limiting**: Implement exponential backoff and circuit breakers
- **Source Validation**: Verify data quality and completeness

### Data Quality Assurance
- **Confidence Scoring**: Track reliability of extracted data
- **Source Provenance**: Maintain complete audit trail
- **Conflict Resolution**: Handle contradictory information from sources
- **Validation Rules**: Enforce strict data quality standards

## User Experience Guidelines

### Status Communication
- Real-time processing step indicators
- Clear error messages with actionable recommendations
- Progress tracking for batch operations
- Visual confidence indicators for data quality

### Data Presentation
- Technical specifications prioritized in detail views
- Russian market compatibility clearly highlighted
- Package logistics data prominently displayed
- Related consumables organized by relevance
- Image validation results with pass/fail indicators

### Manual Review Workflow
- Detailed context for items requiring review
- Recommendations for resolving issues
- Ability to override automated decisions
- Batch approval capabilities for similar items

## Development Priorities

1. **Data Accuracy**: Strict validation and Russian market compliance
2. **Source Reliability**: Robust integration with trusted data sources
3. **Processing Efficiency**: Optimized pipeline with proper error handling
4. **Audit Compliance**: Complete traceability and quality metrics
5. **User Experience**: Intuitive interface for both automated and manual workflows