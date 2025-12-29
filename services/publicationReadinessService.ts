import {
  EnrichedItem,
  ConsumableData,
  ValidationStatus,
  FailureReason,
  ErrorDetail,
  ProcessingStats
} from '../types';

/**
 * Publication Readiness System
 * Implements comprehensive publication readiness evaluation, field validation,
 * data completeness scoring, and bulk approval workflows
 */

// Publication readiness criteria weights
export const READINESS_WEIGHTS = {
  required_fields: 0.4,        // 40% - Core required fields
  data_quality: 0.25,          // 25% - Data quality and confidence
  russian_market: 0.15,        // 15% - Russian market compliance
  image_validation: 0.1,       // 10% - Image quality
  source_reliability: 0.1      // 10% - Source reliability
} as const;

// Required fields for publication
export const REQUIRED_FIELDS = [
  'brand',
  'consumable_type',
  'model',
  'packaging_from_nix',
  'compatible_printers_ru'
] as const;

// Optional but recommended fields
export const RECOMMENDED_FIELDS = [
  'short_model',
  'model_alias_short',
  'yield',
  'color',
  'images',
  'related_consumables_display'
] as const;

// Minimum thresholds for publication readiness
export const READINESS_THRESHOLDS = {
  minimum_score: 0.7,           // 70% minimum overall score
  minimum_confidence: 0.6,      // 60% minimum confidence
  minimum_ru_printers: 1,       // At least 1 verified Russian printer
  minimum_image_score: 0.8,     // 80% image quality score
  minimum_source_count: 2       // At least 2 reliable sources
} as const;

export interface PublicationReadinessScore {
  overall_score: number;        // 0-1 overall readiness score
  component_scores: {
    required_fields: number;    // 0-1 required fields completeness
    data_quality: number;       // 0-1 data quality score
    russian_market: number;     // 0-1 Russian market compliance
    image_validation: number;   // 0-1 image validation score
    source_reliability: number; // 0-1 source reliability score
  };
  is_ready: boolean;           // Whether item meets publication criteria
  blocking_issues: string[];   // Issues preventing publication
  recommendations: string[];   // Recommendations for improvement
  confidence_level: 'high' | 'medium' | 'low';
  estimated_manual_effort: number; // Minutes of manual work needed
}

export interface PublicationReadinessReport {
  total_items: number;
  ready_for_publication: number;
  needs_minor_fixes: number;
  needs_major_work: number;
  blocked_items: number;
  average_readiness_score: number;
  top_blocking_issues: Array<{ issue: string; count: number; severity: 'high' | 'medium' | 'low' }>;
  readiness_by_brand: Record<string, { ready: number; total: number; avg_score: number }>;
  quality_trends: {
    improving: number;
    stable: number;
    declining: number;
  };
}

export interface BulkApprovalCriteria {
  minimum_readiness_score: number;
  required_confidence_level: 'high' | 'medium' | 'low';
  require_russian_verification: boolean;
  require_valid_image: boolean;
  require_nix_packaging: boolean;
  exclude_error_categories: string[];
  include_brands?: string[];
  exclude_brands?: string[];
}

export interface BulkApprovalResult {
  approved_items: string[];
  rejected_items: Array<{ id: string; reasons: string[] }>;
  summary: {
    total_evaluated: number;
    approved_count: number;
    rejected_count: number;
    approval_rate: number;
  };
}

/**
 * Evaluates publication readiness for a single item
 */
export function evaluatePublicationReadiness(item: EnrichedItem): PublicationReadinessScore {
  const componentScores = {
    required_fields: evaluateRequiredFields(item.data),
    data_quality: evaluateDataQuality(item),
    russian_market: evaluateRussianMarketCompliance(item.data),
    image_validation: evaluateImageValidation(item.data),
    source_reliability: evaluateSourceReliability(item)
  };

  // Calculate weighted overall score
  const overall_score =
    componentScores.required_fields * READINESS_WEIGHTS.required_fields +
    componentScores.data_quality * READINESS_WEIGHTS.data_quality +
    componentScores.russian_market * READINESS_WEIGHTS.russian_market +
    componentScores.image_validation * READINESS_WEIGHTS.image_validation +
    componentScores.source_reliability * READINESS_WEIGHTS.source_reliability;

  const blocking_issues = identifyBlockingIssues(item, componentScores);
  const recommendations = generateReadinessRecommendations(item, componentScores);
  const is_ready = overall_score >= READINESS_THRESHOLDS.minimum_score && blocking_issues.length === 0;

  const confidence_level = determineConfidenceLevel(overall_score, item.data.confidence?.overall || 0);
  const estimated_manual_effort = estimateManualEffort(blocking_issues, recommendations);

  return {
    overall_score,
    component_scores: componentScores,
    is_ready,
    blocking_issues,
    recommendations,
    confidence_level,
    estimated_manual_effort
  };
}

/**
 * Evaluates required fields completeness
 */
function evaluateRequiredFields(data: ConsumableData): number {
  let score = 0;
  let totalFields = REQUIRED_FIELDS.length;

  REQUIRED_FIELDS.forEach(field => {
    switch (field) {
      case 'brand':
        if (data.brand && data.brand.trim() !== '') score += 1;
        break;
      case 'consumable_type':
        if (data.consumable_type && data.consumable_type !== 'other') score += 1;
        break;
      case 'model':
        if (data.model && data.model.trim() !== '') score += 1;
        break;
      case 'packaging_from_nix':
        if (data.packaging_from_nix &&
          data.packaging_from_nix.weight_g &&
          data.packaging_from_nix.width_mm &&
          data.packaging_from_nix.height_mm &&
          data.packaging_from_nix.depth_mm) {
          score += 1;
        }
        break;
      case 'compatible_printers_ru':
        if (data.compatible_printers_ru && data.compatible_printers_ru.length > 0) {
          score += 1;
        } else if (data.printers_ru && data.printers_ru.length > 0) {
          // Fallback to legacy field
          score += 0.8; // Slightly lower score for legacy data
        }
        break;
    }
  });

  return score / totalFields;
}

/**
 * Evaluates data quality based on confidence scores and validation status
 */
function evaluateDataQuality(item: EnrichedItem): number {
  const confidence = item.data.confidence;
  if (!confidence) return 0.3; // Low score if no confidence data

  // Weight different confidence components
  const confidenceScore = (
    (confidence.model_name || 0) * 0.3 +
    (confidence.logistics || 0) * 0.25 +
    (confidence.compatibility || 0) * 0.25 +
    (confidence.overall || 0) * 0.2
  );

  // Adjust based on validation status
  let statusMultiplier = 1.0;
  switch (item.status) {
    case 'ok':
      statusMultiplier = 1.0;
      break;
    case 'needs_review':
      statusMultiplier = 0.7;
      break;
    case 'failed':
      statusMultiplier = 0.3;
      break;
    default:
      statusMultiplier = 0.5;
  }

  // Penalize for errors
  const errorPenalty = Math.min((item.error_details?.length || 0) * 0.1, 0.4);

  return Math.max(0, (confidenceScore * statusMultiplier) - errorPenalty);
}

/**
 * Evaluates Russian market compliance
 */
function evaluateRussianMarketCompliance(data: ConsumableData): number {
  let score = 0;

  // Check for verified Russian printers
  const ruPrinters = data.compatible_printers_ru || [];
  const verifiedRuPrinters = ruPrinters.filter(p => p.ruMarketEligibility === 'ru_verified');

  if (verifiedRuPrinters.length >= READINESS_THRESHOLDS.minimum_ru_printers) {
    score += 0.6; // 60% for having verified printers
  } else if (ruPrinters.length > 0) {
    score += 0.3; // 30% for having some Russian printers
  }

  // Check for Russian source verification
  // Fix: Add safe checks for printer sources and source existence
  const russianSources = ruPrinters.flatMap(p => p.sources || [])
    .filter(s => s && (s.sourceType === 'compatibility_db' || (s.url && s.url.includes('.ru'))));

  if (russianSources.length >= READINESS_THRESHOLDS.minimum_source_count) {
    score += 0.4; // 40% for sufficient Russian sources
  } else if (russianSources.length > 0) {
    score += 0.2; // 20% for some Russian sources
  }

  return Math.min(score, 1.0);
}

/**
 * Evaluates image validation quality
 */
function evaluateImageValidation(data: ConsumableData): number {
  if (!data.images || data.images.length === 0) {
    return 0.0; // No images
  }

  const validImages = data.images.filter(img => img.passes_rules);
  if (validImages.length === 0) {
    return 0.2; // Has images but none pass validation
  }

  // Score based on best image quality
  const bestImage = data.images.reduce((best, current) => {
    const currentScore = calculateImageScore(current);
    const bestScore = calculateImageScore(best);
    return currentScore > bestScore ? current : best;
  });

  return calculateImageScore(bestImage);
}

/**
 * Calculates image quality score
 */
function calculateImageScore(image: any): number {
  let score = 0;

  // Resolution check (minimum 800x800)
  if (image.width >= 800 && image.height >= 800) {
    score += 0.3;
  } else if (image.width >= 600 && image.height >= 600) {
    score += 0.2;
  } else {
    score += 0.1;
  }

  // White background score
  score += image.white_bg_score * 0.3;

  // Content validation
  if (!image.is_packaging) score += 0.2;
  if (!image.has_watermark) score += 0.1;
  if (!image.has_oem_logo) score += 0.1; // We want non-OEM look for compatible items

  return Math.min(score, 1.0);
}

/**
 * Evaluates source reliability
 */
function evaluateSourceReliability(item: EnrichedItem): number {
  const sources = item.evidence.sources;
  if (!sources || sources.length === 0) return 0.0;

  let totalReliability = 0;
  let weightedSources = 0;

  sources.forEach(source => {
    if (!source) return;

    let reliability = source.confidence || 0.5;
    let weight = 1;

    // Adjust reliability based on source type - handle both camelCase and snake_case for safety
    const safeSource = source as any;
    if (!safeSource) return;

    const type = safeSource.sourceType || safeSource.source_type;

    switch (type) {
      case 'nix_ru':
        reliability *= 1.2; // NIX.ru is highly reliable for packaging
        weight = 2;
        break;
      case 'official':
        reliability *= 1.1; // Official sources are reliable
        weight = 1.5;
        break;
      case 'compatibility_db':
        reliability *= 1.0; // Standard reliability
        weight = 1;
        break;
      case 'marketplace':
        reliability *= 0.8; // Marketplace sources less reliable
        weight = 0.8;
        break;
      case 'google_search':
        reliability *= 0.7; // Search results less reliable
        weight = 0.7;
        break;
      default:
        reliability *= 0.6; // Unknown sources least reliable
        weight = 0.5;
    }

    totalReliability += reliability * weight;
    weightedSources += weight;
  });

  const averageReliability = weightedSources > 0 ? totalReliability / weightedSources : 0;

  // Bonus for having multiple sources
  const sourceCountBonus = Math.min(sources.length * 0.1, 0.3);

  return Math.min(averageReliability + sourceCountBonus, 1.0);
}

/**
 * Identifies blocking issues preventing publication
 */
function identifyBlockingIssues(item: EnrichedItem, componentScores: any): string[] {
  const issues: string[] = [];

  // Critical required fields missing
  if (componentScores.required_fields < 0.8) {
    if (!item.data.brand) issues.push('Missing brand information');
    if (!item.data.model) issues.push('Missing consumable model');
    if (!item.data.consumable_type || item.data.consumable_type === 'other') {
      issues.push('Consumable type not determined');
    }
    if (!item.data.packaging_from_nix) {
      issues.push('Missing package dimensions from NIX.ru');
    }
  }

  // Russian market compliance issues
  if (componentScores.russian_market < 0.5) {
    const ruPrinters = item.data.compatible_printers_ru || [];
    const verifiedPrinters = ruPrinters.filter(p => p.ruMarketEligibility === 'ru_verified');

    if (verifiedPrinters.length === 0) {
      issues.push('No verified Russian market printers');
    }
  }

  // Critical errors
  const criticalErrors = item.error_details?.filter(e => e.severity === 'critical') || [];
  if (criticalErrors.length > 0) {
    issues.push(`Critical errors: ${criticalErrors.map(e => e.reason).join(', ')}`);
  }

  // Data quality issues
  if (componentScores.data_quality < 0.4) {
    issues.push('Low data quality or confidence scores');
  }

  return issues;
}

/**
 * Generates recommendations for improving publication readiness
 */
function generateReadinessRecommendations(item: EnrichedItem, componentScores: any): string[] {
  const recommendations: string[] = [];

  // Required fields recommendations
  if (componentScores.required_fields < 1.0) {
    if (!item.data.short_model && !item.data.model_alias_short) {
      recommendations.push('Add short model or alias for better searchability');
    }
    if (!item.data.yield) {
      recommendations.push('Add page yield information if available');
    }
    if (!item.data.color && item.data.consumable_type === 'toner_cartridge') {
      recommendations.push('Specify toner color (Black, Cyan, Magenta, Yellow)');
    }
  }

  // Image recommendations
  if (componentScores.image_validation < 0.8) {
    if (!item.data.images || item.data.images.length === 0) {
      recommendations.push('Add high-quality product image (800x800px minimum)');
    } else {
      const validImages = item.data.images.filter(img => img.passes_rules);
      if (validImages.length === 0) {
        recommendations.push('Improve image quality: white background, no watermarks, product only');
      }
    }
  }

  // Russian market recommendations
  if (componentScores.russian_market < 0.8) {
    recommendations.push('Verify printer compatibility in additional Russian sources');
    recommendations.push('Check official Russian distributor websites');
  }

  // Source reliability recommendations
  if (componentScores.source_reliability < 0.7) {
    recommendations.push('Add more reliable data sources');
    recommendations.push('Verify information from official manufacturer sources');
  }

  // Related products recommendations
  if (!item.data.related_consumables_display || item.data.related_consumables_display.length < 3) {
    recommendations.push('Enhance related products discovery for better cross-selling');
  }

  return recommendations;
}

/**
 * Determines confidence level based on scores
 */
function determineConfidenceLevel(overallScore: number, confidenceScore: number): 'high' | 'medium' | 'low' {
  const combinedScore = (overallScore + confidenceScore) / 2;

  if (combinedScore >= 0.8) return 'high';
  if (combinedScore >= 0.6) return 'medium';
  return 'low';
}

/**
 * Estimates manual effort required in minutes
 */
function estimateManualEffort(blockingIssues: string[], recommendations: string[]): number {
  let effort = 0;

  // Base effort for each blocking issue
  effort += blockingIssues.length * 15; // 15 minutes per blocking issue

  // Additional effort for recommendations
  effort += recommendations.length * 5; // 5 minutes per recommendation

  // Specific effort estimates
  blockingIssues.forEach(issue => {
    if (issue.includes('Missing package dimensions')) effort += 20; // NIX.ru research
    if (issue.includes('No verified Russian market')) effort += 30; // Market research
    if (issue.includes('Critical errors')) effort += 25; // Error resolution
  });

  return Math.min(effort, 120); // Cap at 2 hours
}

/**
 * Generates comprehensive publication readiness report
 */
export function generatePublicationReadinessReport(items: EnrichedItem[]): PublicationReadinessReport {
  const evaluations = items.map(item => ({
    item,
    readiness: evaluatePublicationReadiness(item)
  }));

  const ready_for_publication = evaluations.filter(e => e.readiness.is_ready).length;
  const needs_minor_fixes = evaluations.filter(e =>
    !e.readiness.is_ready && e.readiness.overall_score >= 0.6
  ).length;
  const needs_major_work = evaluations.filter(e =>
    e.readiness.overall_score >= 0.3 && e.readiness.overall_score < 0.6
  ).length;
  const blocked_items = evaluations.filter(e => e.readiness.overall_score < 0.3).length;

  const average_readiness_score = evaluations.length > 0
    ? evaluations.reduce((sum, e) => sum + e.readiness.overall_score, 0) / evaluations.length
    : 0;

  // Analyze blocking issues
  const allBlockingIssues = evaluations.flatMap(e => e.readiness.blocking_issues);
  const issueFrequency = allBlockingIssues.reduce((acc, issue) => {
    acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const top_blocking_issues = Object.entries(issueFrequency)
    .map(([issue, count]) => ({
      issue,
      count,
      severity: determineSeverity(issue) as 'high' | 'medium' | 'low'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Analyze by brand
  const readiness_by_brand = evaluations.reduce((acc, e) => {
    const brand = e.item.data.brand || 'Unknown';
    if (!acc[brand]) {
      acc[brand] = { ready: 0, total: 0, avg_score: 0 };
    }
    acc[brand].total += 1;
    if (e.readiness.is_ready) acc[brand].ready += 1;
    acc[brand].avg_score += e.readiness.overall_score;
    return acc;
  }, {} as Record<string, { ready: number; total: number; avg_score: number }>);

  // Calculate average scores by brand
  Object.keys(readiness_by_brand).forEach(brand => {
    readiness_by_brand[brand].avg_score /= readiness_by_brand[brand].total;
  });

  // Quality trends (simplified - would need historical data for real trends)
  const quality_trends = {
    improving: Math.floor(evaluations.length * 0.3), // Placeholder
    stable: Math.floor(evaluations.length * 0.5),    // Placeholder
    declining: Math.floor(evaluations.length * 0.2)  // Placeholder
  };

  return {
    total_items: items.length,
    ready_for_publication,
    needs_minor_fixes,
    needs_major_work,
    blocked_items,
    average_readiness_score,
    top_blocking_issues,
    readiness_by_brand,
    quality_trends
  };
}

/**
 * Determines severity of blocking issue
 */
function determineSeverity(issue: string): string {
  if (issue.includes('Critical errors') || issue.includes('Missing brand') || issue.includes('Missing consumable model')) {
    return 'high';
  }
  if (issue.includes('No verified Russian market') || issue.includes('Missing package dimensions')) {
    return 'medium';
  }
  return 'low';
}

/**
 * Performs bulk approval based on criteria
 */
export function performBulkApproval(
  items: EnrichedItem[],
  criteria: BulkApprovalCriteria
): BulkApprovalResult {
  const approved_items: string[] = [];
  const rejected_items: Array<{ id: string; reasons: string[] }> = [];

  items.forEach(item => {
    const readiness = evaluatePublicationReadiness(item);
    const rejectionReasons: string[] = [];

    // Check readiness score
    if (readiness.overall_score < criteria.minimum_readiness_score) {
      rejectionReasons.push(`Readiness score ${(readiness.overall_score * 100).toFixed(0)}% below minimum ${(criteria.minimum_readiness_score * 100).toFixed(0)}%`);
    }

    // Check confidence level
    const confidenceValue = item.data.confidence?.overall || 0;
    const meetsConfidence =
      (criteria.required_confidence_level === 'high' && confidenceValue >= 0.8) ||
      (criteria.required_confidence_level === 'medium' && confidenceValue >= 0.6) ||
      (criteria.required_confidence_level === 'low' && confidenceValue >= 0.4);

    if (!meetsConfidence) {
      rejectionReasons.push(`Confidence level below ${criteria.required_confidence_level} threshold`);
    }

    // Check Russian verification
    if (criteria.require_russian_verification) {
      const ruPrinters = item.data.compatible_printers_ru || [];
      const hasVerifiedRu = ruPrinters.some(p => p.ruMarketEligibility === 'ru_verified');
      if (!hasVerifiedRu) {
        rejectionReasons.push('No verified Russian market printers');
      }
    }

    // Check valid image
    if (criteria.require_valid_image) {
      const hasValidImage = item.data.images?.some(img => img.passes_rules) || false;
      if (!hasValidImage) {
        rejectionReasons.push('No valid product image');
      }
    }

    // Check NIX packaging
    if (criteria.require_nix_packaging) {
      if (!item.data.packaging_from_nix) {
        rejectionReasons.push('Missing NIX.ru package data');
      }
    }

    // Check error categories
    if (criteria.exclude_error_categories.length > 0) {
      const hasExcludedErrors = item.error_details?.some(error =>
        criteria.exclude_error_categories.includes(error.category)
      ) || false;
      if (hasExcludedErrors) {
        rejectionReasons.push('Contains excluded error categories');
      }
    }

    // Check brand filters
    const itemBrand = item.data.brand;
    if (criteria.include_brands && criteria.include_brands.length > 0) {
      if (!itemBrand || !criteria.include_brands.includes(itemBrand)) {
        rejectionReasons.push('Brand not in inclusion list');
      }
    }
    if (criteria.exclude_brands && criteria.exclude_brands.length > 0) {
      if (itemBrand && criteria.exclude_brands.includes(itemBrand)) {
        rejectionReasons.push('Brand in exclusion list');
      }
    }

    // Final decision
    if (rejectionReasons.length === 0) {
      approved_items.push(item.id);
    } else {
      rejected_items.push({ id: item.id, reasons: rejectionReasons });
    }
  });

  return {
    approved_items,
    rejected_items,
    summary: {
      total_evaluated: items.length,
      approved_count: approved_items.length,
      rejected_count: rejected_items.length,
      approval_rate: items.length > 0 ? (approved_items.length / items.length) * 100 : 0
    }
  };
}

/**
 * Gets publication-ready items based on standard criteria
 */
export function getPublicationReadyItems(items: EnrichedItem[]): EnrichedItem[] {
  return items.filter(item => {
    const readiness = evaluatePublicationReadiness(item);
    return readiness.is_ready;
  });
}

/**
 * Gets items needing attention with prioritization
 */
export function getItemsNeedingAttention(items: EnrichedItem[]): Array<{
  item: EnrichedItem;
  readiness: PublicationReadinessScore;
  priority: 'high' | 'medium' | 'low';
}> {
  return items
    .map(item => {
      const readiness = evaluatePublicationReadiness(item);
      return { item, readiness };
    })
    .filter(entry => !entry.readiness.is_ready)
    .map(entry => {
      // Determine priority based on readiness score
      let priority: 'low' | 'medium' | 'high' = 'low';
      if (entry.readiness.overall_score < 0.4) priority = 'high';
      else if (entry.readiness.overall_score < 0.7) priority = 'medium';

      return {
        item: entry.item,
        readiness: entry.readiness,
        priority
      };
    })
    .sort((a, b) => {
      const priorityScore = { high: 3, medium: 2, low: 1 };
      // Sort by priority first (descending), then by readiness score (ascending)
      if (priorityScore[a.priority] !== priorityScore[b.priority]) {
        return priorityScore[b.priority] - priorityScore[a.priority];
      }
      return a.readiness.overall_score - b.readiness.overall_score;
    });
}