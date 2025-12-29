# API Documentation - Consumable Enricher Pro

## 🔧 Service Architecture

The Consumable Enricher Pro uses a modular service architecture with comprehensive API integrations for data enrichment and validation.

## 🌐 External API Integrations

### 1. Gemini AI Service (`geminiService.ts`)

**Purpose**: AI-powered content generation, analysis, and search grounding

**Configuration**:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Key Features**:
- Search Grounding for autonomous product research
- Structured data extraction with confidence scoring
- Image analysis and OCR capabilities
- Thinking process logging for transparency

**Rate Limiting**: Built-in with exponential backoff
**Circuit Breaker**: Implemented to prevent cascade failures
**Health Monitoring**: Integrated with `apiIntegrationService.ts`

### 2. Firecrawl Service (`firecrawlService.ts`)

**Purpose**: Web scraping with v2 API support and autonomous research

**Configuration**:
```env
FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
```

**Key Features**:
- V2 API integration with enhanced extraction
- Autonomous agent capabilities for deep research
- Rate limiting with circuit breaker patterns
- Source validation and quality checks

**Endpoints Used**:
- `/v2/scrape` - Single page scraping
- `/v2/crawl` - Multi-page crawling
- `/v2/extract` - Structured data extraction

### 3. NIX.ru Service (`nixService.ts`)

**Purpose**: Exclusive source for package dimensions and weight data

**Key Features**:
- Mandatory package data extraction
- Unit conversion (cm→mm, kg→g)
- Validation and quality scoring
- Fallback handling for missing data

**Data Requirements**:
- Package dimensions in millimeters
- Weight in grams
- Source URL and extraction timestamp
- Confidence scoring

### 4. OpenRouter Service (`openRouterService.ts`)

**Purpose**: Alternative LLM integration for flexible model selection

**Configuration**:
```typescript
interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}
```

**Supported Models**:
- GPT-4 variants
- Claude models
- Open-source alternatives
- Custom model endpoints

## 🔍 Data Processing Services

### 1. Text Processing Service (`textProcessingService.ts`)

**Purpose**: Input normalization and pattern extraction

**Functions**:
```typescript
synthesizeConsumableData(context: string, query: string, textProcessingResult: any, firecrawlData?: any): Promise<Data>
processSupplierTitle(title: string): ProcessingResult
normalizeText(input: string): string
extractModel(title: string): ModelExtractionResult
extractBrand(title: string): BrandExtractionResult
extractYield(title: string): YieldExtractionResult
```

**Features**:
- Unicode normalization (NFC)
- Yield notation standardization (15K→15000)
- Model pattern extraction
- Brand detection with expanded patterns
- Color and type classification

### 2. Russian Market Filter (`russianMarketFilter.ts`)

**Purpose**: Russian market compliance and printer verification

**Functions**:
```typescript
filterPrintersForRussianMarket(printers: PrinterCompatibility[]): FilterResult
verifyRussianMarketEligibility(printer: string): EligibilityResult
calculatePrinterEligibilityScore(sources: DataSource[]): number
```

**Requirements**:
- 2+ source verification for ru_verified status
- Trusted Russian sources (cartridge.ru, rashodnika.net)
- Official distributor prioritization
- Separate storage for unverified printers

### 3. Image Validation Service (`imageValidationService.ts`)

**Purpose**: Comprehensive image quality and content validation

**Functions**:
```typescript
validateProductImage(imageUrl: string): ValidationResult
createImageCandidate(url: string): ImageCandidate
checkImageResolution(image: ImageData): boolean
detectWhiteBackground(image: ImageData): number
detectWatermarks(image: ImageData): boolean
```

**Validation Criteria**:
- Minimum 800×800 px resolution
- White background detection (>80% threshold)
- Watermark detection
- OEM logo detection
- Packaging detection

### 4. Publication Readiness Service (`publicationReadinessService.ts`)

**Purpose**: Quality scoring and publication readiness evaluation

**Functions**:
```typescript
evaluatePublicationReadiness(item: EnrichedItem): PublicationReadinessScore
calculateOverallScore(scores: ComponentScores): number
identifyBlockingIssues(item: EnrichedItem): string[]
generateRecommendations(item: EnrichedItem): string[]
```

**Scoring Components**:
- Required fields completeness (100%)
- Data quality assessment (86.5%)
- Russian market compliance (60%)
- Image validation (97%)
- Source reliability (100%)

## 🔄 Supporting Services

### 1. Audit Trail Service (`auditTrailService.ts`)

**Purpose**: Complete source provenance and processing history

**Functions**:
```typescript
createProcessingHistoryEntry(step: ProcessingStep): ProcessingHistoryEntry
createAuditTrailEntry(action: string, details: string): AuditTrailEntry
createEvidenceSource(url: string, claims: string[]): EvidenceSource
enhanceItemWithAuditTrail(item: EnrichedItem): EnrichedItem
```

**Features**:
- Job run ID generation
- Input hash calculation
- Ruleset and parser versioning
- Complete source tracking
- Processing duration monitoring

### 2. Error Handling Service (`errorHandlingService.ts`)

**Purpose**: Comprehensive error categorization and retry logic

**Functions**:
```typescript
createErrorDetail(reason: FailureReason, context?: any): ErrorDetail
shouldRetryItem(item: EnrichedItem): boolean
scheduleRetry(item: EnrichedItem): void
createManualQueueEntry(item: EnrichedItem): ManualQueueEntry
```

**Error Categories**:
- Parsing errors
- Data quality issues
- External service failures
- Validation failures
- Network errors

### 3. Related Products Service (`relatedProductsService.ts`)

**Purpose**: Compatible consumables discovery and prioritization

**Functions**:
```typescript
discoverRelatedProducts(printers: string[]): EnhancedRelatedItem[]
deduplicateRelatedItems(items: RelatedItem[]): RelatedItem[]
prioritizeForDisplay(items: EnhancedRelatedItem[]): EnhancedRelatedItem[]
```

**Features**:
- Multi-source product discovery
- Deduplication with confidence scoring
- Display prioritization (8-12 items)
- Relationship categorization

### 4. API Integration Service (`apiIntegrationService.ts`)

**Purpose**: Centralized API health monitoring and rate limiting

**Functions**:
```typescript
monitorApiHealth(service: string): HealthStatus
implementRateLimit(service: string): Promise<void>
handleCircuitBreaker(service: string): boolean
trackApiUsage(service: string, endpoint: string): void
```

**Features**:
- Circuit breaker pattern implementation
- Rate limiting with exponential backoff
- API usage tracking and monitoring
- Health status reporting

## 📊 Data Types and Interfaces

### Core Data Types (`types/index.ts`)

```typescript
interface EnrichedItem {
  id: string;
  input_raw: string;
  data: ConsumableData;
  evidence: EvidenceBlock;
  status: ValidationStatus;
  error_details?: ErrorDetail[];
  quality_score?: number;
}

interface ConsumableData {
  brand: string | null;
  model: string | null;
  consumable_type: ConsumableType | null;
  yield: YieldInfo | null;
  color: string | null;
  compatible_printers_ru: PrinterCompatibility[];
  packaging_from_nix: PackagingInfo | null;
  images: ImageCandidate[];
  related_consumables_display: EnhancedRelatedItem[];
}
```

### Processing Status Types

```typescript
type ValidationStatus = 'pending' | 'processing' | 'ok' | 'needs_review' | 'failed';
type ProcessingStep = 'idle' | 'searching' | 'scraping_nix' | 'analyzing' | 'finalizing';
type FailureReason = 'failed_parse_model' | 'missing_nix_dimensions_weight' | 'ru_eligibility_unknown';
```

## 🔒 Security and Configuration

### Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### API Key Management

- Secure environment variable handling
- Runtime validation of API keys
- Graceful degradation when services unavailable
- Local storage for optional keys (Firecrawl)

### Rate Limiting Configuration

```typescript
const RATE_LIMITS = {
  gemini: { requestsPerMinute: 60, burstLimit: 10 },
  firecrawl: { requestsPerMinute: 30, burstLimit: 5 },
  nix: { requestsPerMinute: 20, burstLimit: 3 }
};
```

## 📈 Monitoring and Metrics

### Health Monitoring

- API endpoint availability
- Response time tracking
- Error rate monitoring
- Circuit breaker status

### Quality Metrics

- Processing success rate (target >95%)
- Data completeness scoring
- Source reliability assessment
- Publication readiness scores

### Performance Metrics

- Average processing time (13-233ms)
- Throughput per minute
- Queue processing efficiency
- Retry success rates

## 🚀 Deployment Considerations

### Production Requirements

1. **API Quota Management**
   - Monitor Gemini API usage
   - Implement quota alerts
   - Consider API key rotation

2. **Service Dependencies**
   - NIX.ru availability monitoring
   - Firecrawl service health checks
   - Google Cloud credentials setup

3. **Error Handling**
   - Circuit breaker configuration
   - Retry policy tuning
   - Manual queue monitoring

### Scaling Considerations

- Batch processing optimization
- Parallel API calls where appropriate
- Caching strategies for repeated requests
- Database persistence for large datasets

This API documentation reflects the current implementation status and provides comprehensive guidance for deployment and maintenance of the Consumable Enricher Pro system.