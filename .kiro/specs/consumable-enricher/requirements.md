# Requirements Document

## Introduction

The Consumable Enricher Pro system automatically transforms supplier product titles into structured, enriched consumable cards for printing supplies. The system integrates with AI services and web scraping to extract, validate, and enrich product data according to strict Russian market requirements.

## Glossary

- **Consumable**: Printer supplies like toner cartridges, drum units, ink cartridges, maintenance kits
- **Supplier_Title**: Raw product name from supplier input
- **Enrichment_Engine**: Core AI-powered system that processes and enriches product data
- **NIX_Service**: Service that fetches package dimensions and weight exclusively from nix.ru
- **Compatibility_Service**: Service that determines printer compatibility from multiple trusted sources
- **Image_Validator**: Component that validates product images against strict quality requirements
- **Manual_Queue**: Queue for items requiring human review and intervention
- **RU_Market_Filter**: Component that filters printers for Russian market eligibility
- **Processing_Pipeline**: Complete workflow from input to enriched output

## Requirements

### Requirement 1: Process Supplier Input Data

**User Story:** As a data processor, I want to import and normalize supplier product titles, so that I can extract structured product information consistently.

#### Acceptance Criteria

1. WHEN a supplier title is provided via text input, THE Enrichment_Engine SHALL normalize Unicode characters and remove extra spaces
2. WHEN a product image is uploaded, THE Enrichment_Engine SHALL use OCR to extract product information from packaging
3. WHEN processing batch imports, THE Enrichment_Engine SHALL queue items for sequential processing
4. WHEN normalizing text, THE Enrichment_Engine SHALL standardize yield notations (15K→15000, 300К→300000)
5. WHEN parsing titles, THE Enrichment_Engine SHALL extract consumable models using letter+number patterns
6. WHEN multiple model candidates exist, THE Enrichment_Engine SHALL select the most specific based on context
7. WHEN determining consumable type, THE Enrichment_Engine SHALL classify as toner_cartridge, drum_unit, ink_cartridge, or other types
8. WHEN extracting printer brand, THE Enrichment_Engine SHALL identify from title text or model prefix patterns

### Requirement 2: Enrich Data from External Sources

**User Story:** As a product manager, I want to enrich basic product data with comprehensive specifications, so that I can create complete product records.

#### Acceptance Criteria

1. WHEN enriching package data, THE NIX_Service SHALL query exclusively nix.ru for dimensions and weight
2. WHEN package data is found, THE NIX_Service SHALL convert all measurements to millimeters and grams
3. IF package data is unavailable from nix.ru, THEN THE Enrichment_Engine SHALL set status to needs_review
4. WHEN researching compatibility, THE Compatibility_Service SHALL query cartridge.ru, rashodnika.net, and OEM sources
5. WHEN merging compatibility data, THE Compatibility_Service SHALL preserve source provenance and timestamps
6. WHEN source conflicts occur, THE Compatibility_Service SHALL flag items for manual review
7. WHEN using Firecrawl autonomous agents, THE Enrichment_Engine SHALL implement timeout and credit limits
8. WHEN API rate limits are encountered, THE Enrichment_Engine SHALL implement exponential backoff retry

### Requirement 3: Apply Russian Market Filtering

**User Story:** As a product manager, I want to ensure printer compatibility is relevant for the Russian market, so that customers see only applicable printers.

#### Acceptance Criteria

1. WHEN evaluating printer eligibility, THE RU_Market_Filter SHALL verify presence in Russian-language sources
2. WHEN a printer appears in 2+ Russian sources, THE RU_Market_Filter SHALL mark it as ru_verified
3. WHEN printer eligibility cannot be confirmed, THE RU_Market_Filter SHALL mark it as ru_unknown
4. WHEN creating final compatibility lists, THE RU_Market_Filter SHALL include only ru_verified printers
5. WHEN storing unverified data, THE RU_Market_Filter SHALL maintain separate unverified printer lists
6. WHEN applying market filters, THE RU_Market_Filter SHALL prioritize official Russian distributor sources

### Requirement 4: Validate Product Images

**User Story:** As a quality controller, I want to validate product images against strict criteria, so that only appropriate images are used in product records.

#### Acceptance Criteria

1. WHEN validating image resolution, THE Image_Validator SHALL require minimum 800x800 pixels
2. WHEN analyzing image content, THE Image_Validator SHALL verify images show only the cartridge without packaging
3. WHEN checking backgrounds, THE Image_Validator SHALL ensure white background within configured thresholds
4. WHEN detecting text, THE Image_Validator SHALL reject images containing brand logos or trademarks
5. WHEN finding watermarks, THE Image_Validator SHALL reject images with any watermark presence
6. IF no valid image exists, THEN THE Image_Validator SHALL set publish_ready to false
7. WHEN using approved image libraries, THE Image_Validator SHALL prioritize pre-validated compatible images

### Requirement 5: Generate Related Product Recommendations

**User Story:** As a customer, I want to see related consumables for my printer, so that I can find all supplies I need.

#### Acceptance Criteria

1. WHEN generating related items, THE Enrichment_Engine SHALL find consumables for the same compatible printers
2. WHEN collecting related data, THE Enrichment_Engine SHALL query multiple compatibility databases
3. WHEN normalizing related models, THE Enrichment_Engine SHALL remove duplicates and exclude current item
4. WHEN creating display lists, THE Enrichment_Engine SHALL prioritize same-type consumables and limit to 8-12 items
5. WHEN maintaining full lists, THE Enrichment_Engine SHALL preserve complete related_consumables_full arrays
6. WHEN organizing relationships, THE Enrichment_Engine SHALL categorize by relationship type (companion, alternative, etc.)

### Requirement 6: Manage Processing Status and Quality Control

**User Story:** As a system operator, I want to track processing status and handle errors systematically, so that I can maintain data quality.

#### Acceptance Criteria

1. WHEN processing completes successfully, THE Enrichment_Engine SHALL set automation_status to done
2. WHEN required data is missing, THE Enrichment_Engine SHALL set automation_status to needs_review
3. WHEN parsing fails completely, THE Enrichment_Engine SHALL set automation_status to failed with specific reasons
4. WHEN creating manual queue entries, THE Enrichment_Engine SHALL include context, recommendations, and source data
5. WHEN handling retries, THE Enrichment_Engine SHALL allow reprocessing of failed items
6. WHEN tracking confidence, THE Enrichment_Engine SHALL provide confidence scores for key data fields
7. WHEN processing batches, THE Enrichment_Engine SHALL provide real-time progress indicators

### Requirement 7: Maintain Audit Trail and Data Provenance

**User Story:** As a data auditor, I want complete traceability of data sources and processing steps, so that I can verify data quality.

#### Acceptance Criteria

1. WHEN processing items, THE Enrichment_Engine SHALL log job metadata including timestamps and versions
2. WHEN enriching fields, THE Enrichment_Engine SHALL record source URLs, extraction timestamps, and confidence levels
3. WHEN storing results, THE Enrichment_Engine SHALL maintain complete processing step history
4. WHEN tracking sources, THE Enrichment_Engine SHALL categorize by source type (nix_ru, official, compatibility_db, etc.)
5. WHEN preserving evidence, THE Enrichment_Engine SHALL store relevant text snippets and extraction context
6. WHEN monitoring quality, THE Enrichment_Engine SHALL track completion rates and manual queue metrics

### Requirement 8: Support User Interface and Export Functions

**User Story:** As a user, I want an intuitive interface to manage the enrichment process and export results, so that I can efficiently work with product data.

#### Acceptance Criteria

1. WHEN importing data, THE User_Interface SHALL support both text input and photo recognition
2. WHEN displaying results, THE User_Interface SHALL provide filtering, searching, and sorting capabilities
3. WHEN showing item details, THE User_Interface SHALL organize information in tabbed views (specs, evidence, images, etc.)
4. WHEN exporting data, THE User_Interface SHALL generate CSV files with selected fields
5. WHEN managing settings, THE User_Interface SHALL validate API keys and show service status
6. WHEN processing items, THE User_Interface SHALL show real-time status updates and progress indicators
7. WHEN handling errors, THE User_Interface SHALL provide clear error messages and retry options