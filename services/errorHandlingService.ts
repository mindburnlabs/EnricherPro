import {
  ErrorDetail,
  FailureReason,
  ErrorCategory,
  ErrorSeverity,
  RetryConfig,
  ManualQueueEntry,
  BatchProcessingProgress,
  EnrichedItem,
  ConsumableData,
  ProcessingStep
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced Error Handling and Status Management Service
 * Implements comprehensive error categorization, retry mechanisms, and manual queue management
 */

// Default retry configuration with exponential backoff
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'api_rate_limit_exceeded',
    'external_service_timeout',
    'network_connectivity_error',
    'data_parsing_error',
    'validation_timeout'
  ]
};

// Error categorization mapping
const ERROR_CATEGORIZATION: Record<FailureReason, { category: ErrorCategory; severity: ErrorSeverity; retryable: boolean }> = {
  // Parsing errors - usually not retryable
  'failed_parse_model': { category: 'parsing_error', severity: 'high', retryable: false },
  'failed_parse_type': { category: 'parsing_error', severity: 'high', retryable: false },
  'failed_parse_brand': { category: 'parsing_error', severity: 'medium', retryable: false },

  // Data quality issues - may be retryable with different approach
  'missing_nix_dimensions_weight': { category: 'data_quality', severity: 'high', retryable: true },
  'nix_data_from_fallback': { category: 'data_quality', severity: 'medium', retryable: false },
  'low_confidence_nix_data': { category: 'data_quality', severity: 'medium', retryable: true },
  'low_confidence_agent_research': { category: 'data_quality', severity: 'medium', retryable: true },
  'no_oem_sources': { category: 'data_quality', severity: 'low', retryable: true },
  'insufficient_ru_verification': { category: 'data_quality', severity: 'medium', retryable: true },
  'invalid_dimensions': { category: 'validation_failure', severity: 'medium', retryable: false },
  'invalid_weight': { category: 'validation_failure', severity: 'medium', retryable: false },
  'incomplete_data': { category: 'data_quality', severity: 'medium', retryable: true },

  // Image validation issues
  'missing_valid_image': { category: 'validation_failure', severity: 'medium', retryable: true },
  'image_validation_issues': { category: 'validation_failure', severity: 'low', retryable: true },

  // Russian market filtering
  'ru_eligibility_unknown': { category: 'data_quality', severity: 'medium', retryable: true },
  'compatibility_conflict': { category: 'data_quality', severity: 'high', retryable: false },

  // External service errors - usually retryable
  'api_rate_limit_exceeded': { category: 'external_service', severity: 'medium', retryable: true },
  'external_service_timeout': { category: 'timeout_error', severity: 'medium', retryable: true },
  'network_connectivity_error': { category: 'network_error', severity: 'high', retryable: true },
  'authentication_failed': { category: 'authentication_error', severity: 'critical', retryable: false },
  'data_parsing_error': { category: 'parsing_error', severity: 'medium', retryable: true },
  'validation_timeout': { category: 'timeout_error', severity: 'medium', retryable: true }
};

/**
 * Creates a detailed error object with categorization and retry information
 */
export function createErrorDetail(
  reason: FailureReason,
  message: string,
  context?: Record<string, any>,
  step?: ProcessingStep,
  technicalDetails?: string
): ErrorDetail {
  const categorization = ERROR_CATEGORIZATION[reason];

  return {
    reason,
    category: categorization.category,
    severity: categorization.severity,
    message,
    context,
    timestamp: new Date().toISOString(),
    step,
    retryable: categorization.retryable,
    suggestedAction: generateSuggestedAction(reason, categorization),
    technicalDetails
  };
}

/**
 * Generates suggested actions for different error types
 */
function generateSuggestedAction(reason: FailureReason, categorization: { category: ErrorCategory; severity: ErrorSeverity; retryable: boolean }): string {
  switch (categorization.category) {
    case 'parsing_error':
      return 'Review input format and consider manual data entry or title reformatting';
    case 'data_quality':
      return 'Verify data sources and consider alternative research methods';
    case 'external_service':
      return 'Check service status and API credentials, retry with exponential backoff';
    case 'validation_failure':
      return 'Review validation criteria and consider manual override if appropriate';
    case 'network_error':
      return 'Check network connectivity and retry after brief delay';
    case 'authentication_error':
      return 'Verify API keys and service credentials';
    case 'timeout_error':
      return 'Increase timeout limits or retry with smaller batch sizes';
    case 'configuration_error':
      return 'Review system configuration and service settings';
    default:
      return 'Review error details and consider manual intervention';
  }
}

/**
 * Determines if an error is retryable based on configuration
 */
export function isRetryableError(reason: FailureReason, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return config.retryableErrors.includes(reason) && ERROR_CATEGORIZATION[reason].retryable;
}

/**
 * Calculates next retry delay using exponential backoff
 */
export function calculateRetryDelay(attemptNumber: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Determines if an item should be retried based on error details and retry count
 */
export function shouldRetryItem(item: EnrichedItem, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  if (item.retry_count >= config.maxAttempts) {
    return false;
  }

  // Check if any errors are retryable
  const hasRetryableErrors = item.error_details?.some(error => isRetryableError(error.reason, config)) || false;

  return hasRetryableErrors;
}

/**
 * Creates a manual queue entry for items requiring human review
 */
export function createManualQueueEntry(
  item: EnrichedItem,
  extractedData: Partial<ConsumableData>,
  missingFields: string[],
  priority: 'low' | 'medium' | 'high' = 'medium'
): ManualQueueEntry {
  const recommendations = generateRecommendations(item.error_details || [], extractedData, missingFields);
  const estimatedTime = estimateResolutionTime(item.error_details || [], priority);

  return {
    itemId: item.id,
    inputRaw: item.input_raw,
    failureReasons: item.error_details || [],
    extractedData,
    missingFields,
    recommendations,
    context: {
      processingHistory: item.evidence.processing_history,
      evidenceSources: item.evidence.sources,
      confidenceScores: item.data.confidence,
      qualityMetrics: item.evidence.quality_metrics
    },
    priority,
    estimatedResolutionTime: estimatedTime,
    queuedAt: new Date().toISOString(),
    lastAttemptAt: item.updated_at ? new Date(item.updated_at).toISOString() : undefined,
    attemptCount: item.retry_count || 0
  };
}

/**
 * Generates specific recommendations based on error types
 */
function generateRecommendations(errors: ErrorDetail[], extractedData: Partial<ConsumableData>, missingFields: string[]): string[] {
  const recommendations: string[] = [];

  // Group errors by category for targeted recommendations
  const errorsByCategory = errors.reduce((acc, error) => {
    if (!acc[error.category]) acc[error.category] = [];
    acc[error.category].push(error);
    return acc;
  }, {} as Record<ErrorCategory, ErrorDetail[]>);

  // Parsing error recommendations
  if (errorsByCategory.parsing_error) {
    recommendations.push('Consider reformatting the supplier title to include clear model numbers');
    recommendations.push('Verify that the input contains recognizable printer consumable patterns');
    if (missingFields.includes('model')) {
      recommendations.push('Manually enter the consumable model number if visible in packaging');
    }
  }

  // Data quality recommendations
  if (errorsByCategory.data_quality) {
    if (missingFields.includes('packaging_from_nix')) {
      recommendations.push('Search NIX.ru manually for package dimensions and weight');
      recommendations.push('Consider using alternative logistics sources if NIX.ru data unavailable');
    }
    if (extractedData.compatible_printers_ru?.length === 0) {
      recommendations.push('Verify printer compatibility in Russian market sources (cartridge.ru, rashodnika.net)');
      recommendations.push('Check if printers are sold through official Russian distributors');
    }
  }

  // External service recommendations
  if (errorsByCategory.external_service || errorsByCategory.network_error) {
    recommendations.push('Retry processing after checking service availability');
    recommendations.push('Verify API credentials and rate limits');
  }

  // Validation failure recommendations
  if (errorsByCategory.validation_failure) {
    if (missingFields.includes('images') || errors.some(e => e.reason === 'missing_valid_image')) {
      recommendations.push('Upload a high-quality product image (800x800px minimum, white background)');
      recommendations.push('Ensure image shows only the consumable without packaging or watermarks');
    }
  }

  // General recommendations based on missing fields
  if (missingFields.length > 0) {
    recommendations.push(`Complete missing required fields: ${missingFields.join(', ')}`);
  }

  return recommendations;
}

/**
 * Estimates resolution time based on error complexity and priority
 */
function estimateResolutionTime(errors: ErrorDetail[], priority: 'low' | 'medium' | 'high'): number {
  let baseTime = 15; // Base 15 minutes

  // Adjust based on error complexity
  const complexErrors = errors.filter(e => e.severity === 'high' || e.severity === 'critical').length;
  const mediumErrors = errors.filter(e => e.severity === 'medium').length;

  baseTime += complexErrors * 20; // 20 minutes per complex error
  baseTime += mediumErrors * 10;  // 10 minutes per medium error

  // Adjust based on priority
  switch (priority) {
    case 'high':
      return Math.max(baseTime * 0.7, 5); // Prioritize, minimum 5 minutes
    case 'low':
      return baseTime * 1.5; // Lower priority, more time
    default:
      return baseTime;
  }
}

/**
 * Creates initial batch processing progress tracker
 */
export function createBatchProcessingProgress(totalItems: number): BatchProcessingProgress {
  return {
    totalItems,
    processedItems: 0,
    successfulItems: 0,
    failedItems: 0,
    needsReviewItems: 0,
    currentItem: undefined,
    currentStep: undefined,
    estimatedTimeRemaining: 0,
    averageProcessingTime: 0,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    throughputPerMinute: 0,
    errorRate: 0
  };
}

/**
 * Updates batch processing progress with new item completion
 */
export function updateBatchProgress(
  progress: BatchProcessingProgress,
  item: EnrichedItem,
  processingTimeMs: number
): BatchProcessingProgress {
  const now = new Date();
  const updatedProgress = { ...progress };

  updatedProgress.processedItems += 1;

  // Update counters based on item status
  switch (item.status) {
    case 'ok':
      updatedProgress.successfulItems += 1;
      break;
    case 'needs_review':
      updatedProgress.needsReviewItems += 1;
      break;
    case 'failed':
      updatedProgress.failedItems += 1;
      break;
  }

  // Update timing metrics
  const totalProcessingTime = (updatedProgress.averageProcessingTime * (updatedProgress.processedItems - 1)) + processingTimeMs;
  updatedProgress.averageProcessingTime = totalProcessingTime / updatedProgress.processedItems;

  // Calculate throughput
  const elapsedMinutes = (now.getTime() - new Date(progress.startedAt).getTime()) / (1000 * 60);
  updatedProgress.throughputPerMinute = elapsedMinutes > 0 ? updatedProgress.processedItems / elapsedMinutes : 0;

  // Calculate error rate
  updatedProgress.errorRate = (updatedProgress.failedItems / updatedProgress.processedItems) * 100;

  // Estimate remaining time
  const remainingItems = updatedProgress.totalItems - updatedProgress.processedItems;
  updatedProgress.estimatedTimeRemaining = remainingItems * (updatedProgress.averageProcessingTime / 1000);

  updatedProgress.lastUpdatedAt = now.toISOString();
  updatedProgress.currentItem = undefined;
  updatedProgress.currentStep = undefined;

  return updatedProgress;
}

/**
 * Updates current processing item and step
 */
export function updateCurrentProcessing(
  progress: BatchProcessingProgress,
  itemId: string,
  step: ProcessingStep
): BatchProcessingProgress {
  return {
    ...progress,
    currentItem: itemId,
    currentStep: step,
    lastUpdatedAt: new Date().toISOString()
  };
}

/**
 * Categorizes errors for reporting and analysis
 */
export function categorizeErrors(items: EnrichedItem[]): Record<ErrorCategory, { count: number; examples: string[] }> {
  const categories: Record<ErrorCategory, { count: number; examples: string[] }> = {
    parsing_error: { count: 0, examples: [] },
    data_quality: { count: 0, examples: [] },
    external_service: { count: 0, examples: [] },
    validation_failure: { count: 0, examples: [] },
    network_error: { count: 0, examples: [] },
    authentication_error: { count: 0, examples: [] },
    timeout_error: { count: 0, examples: [] },
    configuration_error: { count: 0, examples: [] }
  };

  items.forEach(item => {
    item.error_details?.forEach(error => {
      categories[error.category].count += 1;
      if (categories[error.category].examples.length < 3) {
        categories[error.category].examples.push(error.message);
      }
    });
  });

  return categories;
}

/**
 * Generates error summary for monitoring and reporting
 */
export function generateErrorSummary(items: EnrichedItem[]): {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  retryableErrors: number;
  criticalErrors: number;
  topErrors: Array<{ reason: FailureReason; count: number; message: string }>;
} {
  const allErrors = items.flatMap(item => item.error_details || []);

  const errorsByCategory = allErrors.reduce((acc, error) => {
    acc[error.category] = (acc[error.category] || 0) + 1;
    return acc;
  }, {} as Record<ErrorCategory, number>);

  const errorsBySeverity = allErrors.reduce((acc, error) => {
    acc[error.severity] = (acc[error.severity] || 0) + 1;
    return acc;
  }, {} as Record<ErrorSeverity, number>);

  const retryableErrors = allErrors.filter(error => error.retryable).length;
  const criticalErrors = allErrors.filter(error => error.severity === 'critical').length;

  // Count top error reasons
  const errorCounts = allErrors.reduce((acc, error) => {
    const key = error.reason;
    if (!acc[key]) {
      acc[key] = { count: 0, message: error.message };
    }
    acc[key].count += 1;
    return acc;
  }, {} as Record<FailureReason, { count: number; message: string }>);

  const topErrors = Object.entries(errorCounts)
    .map(([reason, data]: [string, { count: number, message: string }]) => ({ reason: reason as FailureReason, count: data.count, message: data.message }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalErrors: allErrors.length,
    errorsByCategory,
    errorsBySeverity,
    retryableErrors,
    criticalErrors,
    topErrors
  };
}

/**
 * Schedules an item for retry with exponential backoff
 */
export function scheduleRetry(item: EnrichedItem, config: RetryConfig = DEFAULT_RETRY_CONFIG): EnrichedItem {
  const nextRetryDelay = calculateRetryDelay(item.retry_count + 1, config);
  const nextRetryAt = new Date(Date.now() + nextRetryDelay).toISOString();

  return {
    ...item,
    retry_count: item.retry_count + 1,
    last_retry_at: new Date().toISOString(),
    next_retry_at: nextRetryAt,
    is_retryable: shouldRetryItem({ ...item, retry_count: item.retry_count + 1 }, config),
    updated_at: Date.now()
  };
}

/**
 * Checks if an item is ready for retry based on scheduled time
 */
export function isReadyForRetry(item: EnrichedItem): boolean {
  if (!item.is_retryable || !item.next_retry_at) {
    return false;
  }

  return new Date() >= new Date(item.next_retry_at);
}

/**
 * Gets items that are ready for retry
 */
export function getItemsReadyForRetry(items: EnrichedItem[]): EnrichedItem[] {
  return items.filter(item =>
    item.status === 'failed' &&
    item.is_retryable &&
    isReadyForRetry(item)
  );
}