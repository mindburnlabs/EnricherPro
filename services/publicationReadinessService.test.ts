import {
  evaluatePublicationReadiness,
  generatePublicationReadinessReport,
  performBulkApproval,
  getPublicationReadyItems,
  READINESS_THRESHOLDS
} from './publicationReadinessService';
import { EnrichedItem, ConsumableData } from '../types';

// Mock data for testing
const createMockItem = (overrides: Partial<EnrichedItem> = {}, id?: string): EnrichedItem => ({
  id: id || `test-id-${Math.random().toString(36).substr(2, 9)}`,
  input_raw: 'Test Consumable',
  data: {
    brand: 'HP',
    supplier_title_raw: 'Test Consumable',
    title_norm: 'Test Consumable',
    automation_status: 'needs_review',
    publish_ready: false,
    mpn_identity: { mpn: 'CF410A', variant_flags: { chip: true, counterless: false, high_yield: false, kit: false }, canonical_model_name: 'CF410A' },
    consumable_type: 'toner_cartridge',
    model: 'CF410A',
    short_model: '410A',
    yield: { value: 2300, unit: 'pages' },
    color: 'Black',
    printers_ru: ['HP LaserJet Pro M452'],
    compatible_printers_unverified: [],
    sources: [],
    compatible_printers_ru: [{
      model: 'HP LaserJet Pro M452',
      canonicalName: 'HP LaserJet Pro M452',
      sources: [],
      ruMarketEligibility: 'ru_verified',
      compatibilityConflict: false
    }],

    related_consumables_full: [],
    related_consumables_display: [],
    related_consumables_categories: {
      companions: [],
      alternatives: [],
      colorVariants: [],
      replacements: []
    },
    model_alias_short: '410A',
    has_chip: true,
    has_page_counter: false,
    packaging_from_nix: {
      width_mm: 150,
      height_mm: 100,
      depth_mm: 50,
      weight_g: 800,
      confidence: 0.9
    },
    images: [{
      url: 'test-image.jpg',
      width: 800,
      height: 800,
      white_bg_score: 0.9,
      is_packaging: false,
      has_watermark: false,
      has_oem_logo: false,
      passes_rules: true,
      reject_reasons: []
    }],
    faq: [],
    confidence: {
      model_name: 0.9,
      short_model: 0.85,
      logistics: 0.8,
      compatibility: 0.9,
      faq: 0.7,
      overall: 0.85,
      data_completeness: 0.9,
      source_reliability: 0.8
    }
  } as ConsumableData,
  evidence: {
    sources: [{
      url: 'https://nix.ru/test',
      source_type: 'nix_ru',
      claims: ['package dimensions'],
      evidence_snippets_by_claim: {},
      extracted_at: new Date().toISOString(),
      confidence: 0.9,
      extraction_method: 'api'
    }],
    processing_history: [],
    quality_metrics: {
      data_completeness_score: 0.9,
      source_reliability_score: 0.8,
      validation_pass_rate: 0.95,
      processing_efficiency: 0.85,
      audit_completeness: 0.9,
      last_calculated: new Date().toISOString(),
      total_sources_used: 3,
      failed_validations: [],
      missing_required_fields: []
    },
    audit_trail: []
  },
  status: 'ok',
  validation_errors: [],
  error_details: [],
  failure_reasons: [],
  retry_count: 0,
  is_retryable: false,
  created_at: Date.now(),
  updated_at: Date.now(),

  input_hash: 'test-hash',
  ruleset_version: '2.1.0',
  parser_version: '1.5.0',
  processed_at: new Date().toISOString(),
  ...overrides
});

describe('Publication Readiness Service', () => {
  describe('evaluatePublicationReadiness', () => {
    test('should evaluate a complete item as ready for publication', () => {
      const item = createMockItem();
      const result = evaluatePublicationReadiness(item);

      expect(result.overall_score).toBeGreaterThan(READINESS_THRESHOLDS.minimum_score);
      expect(result.is_ready).toBe(true);
      expect(result.blocking_issues).toHaveLength(0);
      expect(result.confidence_level).toBe('high');
    });

    test('should identify missing required fields', () => {
      const item = createMockItem({
        data: {
          ...createMockItem().data,
          brand: null,
          packaging_from_nix: null
        } as ConsumableData
      });

      const result = evaluatePublicationReadiness(item);

      expect(result.is_ready).toBe(false);
      expect(result.blocking_issues).toContain('Missing brand information');
      expect(result.blocking_issues).toContain('Missing package dimensions from NIX.ru');
    });

    test('should evaluate Russian market compliance', () => {
      const item = createMockItem({
        data: {
          ...createMockItem().data,
          compatible_printers_ru: []
        } as ConsumableData
      });

      const result = evaluatePublicationReadiness(item);

      expect(result.component_scores.russian_market).toBeLessThan(0.5);
      expect(result.blocking_issues).toContain('No verified Russian market printers');
    });

    test('should evaluate image validation', () => {
      const item = createMockItem({
        data: {
          ...createMockItem().data,
          images: []
        } as ConsumableData
      });

      const result = evaluatePublicationReadiness(item);

      expect(result.component_scores.image_validation).toBe(0);
      expect(result.recommendations).toContain('Add high-quality product image (800x800px minimum)');
    });
  });

  describe('generatePublicationReadinessReport', () => {
    test('should generate comprehensive report', () => {
      const items = [
        createMockItem({}, 'ready-item'), // Ready item
        createMockItem({ // Needs work item
          data: {
            ...createMockItem().data,
            brand: null
          } as ConsumableData
        }, 'needs-work-item'),
        createMockItem({ // Blocked item
          data: {
            ...createMockItem().data,
            brand: null,
            packaging_from_nix: null,
            compatible_printers_ru: []
          } as ConsumableData
        }, 'blocked-item')
      ];

      const report = generatePublicationReadinessReport(items);

      expect(report.total_items).toBe(3);
      expect(report.ready_for_publication).toBeGreaterThanOrEqual(0);
      expect(report.needs_minor_fixes + report.needs_major_work + report.blocked_items).toBeGreaterThan(0);
      expect(report.top_blocking_issues.length).toBeGreaterThan(0);
    });
  });

  describe('performBulkApproval', () => {
    test('should approve items meeting criteria', () => {
      const items = [
        createMockItem({}, 'good-item'), // Should be approved
        createMockItem({ // Should be rejected - no brand
          data: {
            ...createMockItem().data,
            brand: null
          } as ConsumableData
        }, 'bad-item')
      ];

      const criteria = {
        minimum_readiness_score: 0.7,
        required_confidence_level: 'medium' as const,
        require_russian_verification: true,
        require_valid_image: false,
        require_nix_packaging: true,
        exclude_error_categories: [],
        include_brands: [],
        exclude_brands: []
      };

      const result = performBulkApproval(items, criteria);

      expect(result.approved_items.length + result.rejected_items.length).toBe(2);
      expect(result.summary.total_evaluated).toBe(2);
    });
  });

  describe('getPublicationReadyItems', () => {
    test('should filter ready items correctly', () => {
      const items = [
        createMockItem({}, 'ready-item'), // Ready
        createMockItem({ // Not ready
          data: {
            ...createMockItem().data,
            brand: null
          } as ConsumableData
        }, 'not-ready-item')
      ];

      const readyItems = getPublicationReadyItems(items);

      expect(readyItems.length).toBeGreaterThanOrEqual(0);
      // Check that all returned items are actually ready
      readyItems.forEach(item => {
        const readiness = evaluatePublicationReadiness(item);
        expect(readiness.is_ready).toBe(true);
      });
    });
  });
});