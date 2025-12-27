/**
 * Audit Trail Service for Consumable Enricher
 * Implements comprehensive source tracking, confidence scoring, and quality metrics
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { 
  ProcessingHistoryEntry, 
  QualityMetrics, 
  AuditTrailEntry, 
  EvidenceSource, 
  ConfidenceScores,
  ProcessingStep,
  EnrichedItem,
  EvidenceBlock
} from '../types';

// Version constants for audit trail
export const RULESET_VERSION = '2.1.0';
export const PARSER_VERSION = '1.5.0';

/**
 * Creates a hash of input data for audit trail tracking
 * Requirements: 7.1 - Log job metadata including timestamps and versions
 */
export function createInputHash(input: string): string {
  // Simple hash function for browser environment
  let hash = 0;
  if (input.length === 0) return hash.toString(16);
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generates a unique job run ID
 * Requirements: 7.1 - Log job metadata including timestamps and versions
 */
export function generateJobRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

/**
 * Creates a processing history entry
 * Requirements: 7.4 - Track complete processing step history
 */
export function createProcessingHistoryEntry(
  step: ProcessingStep,
  status: 'started' | 'completed' | 'failed' | 'skipped',
  options: {
    inputData?: any;
    outputData?: any;
    errorMessage?: string;
    confidenceBefore?: number;
    confidenceAfter?: number;
    dataChanges?: string[];
    startTime?: Date;
    endTime?: Date;
  } = {}
): ProcessingHistoryEntry {
  const now = new Date().toISOString();
  const startTime = options.startTime || new Date();
  const endTime = options.endTime || new Date();
  
  return {
    step,
    started_at: startTime.toISOString(),
    completed_at: status === 'completed' ? endTime.toISOString() : undefined,
    duration_ms: status === 'completed' ? endTime.getTime() - startTime.getTime() : undefined,
    status,
    input_data: options.inputData,
    output_data: options.outputData,
    error_message: options.errorMessage,
    confidence_before: options.confidenceBefore,
    confidence_after: options.confidenceAfter,
    data_changes: options.dataChanges || []
  };
}

/**
 * Creates an audit trail entry
 * Requirements: 7.2 - Record source URLs, extraction timestamps, and confidence levels
 */
export function createAuditTrailEntry(
  action: 'data_extraction' | 'validation' | 'transformation' | 'enrichment' | 'quality_check' | 'error_handling',
  component: string,
  details: string,
  options: {
    inputHash?: string;
    outputHash?: string;
    confidenceImpact?: number;
    dataFieldsAffected?: string[];
    sourceUrls?: string[];
    processingTimeMs?: number;
  } = {}
): AuditTrailEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    component,
    details,
    input_hash: options.inputHash,
    output_hash: options.outputHash,
    confidence_impact: options.confidenceImpact,
    data_fields_affected: options.dataFieldsAffected || [],
    source_urls: options.sourceUrls || [],
    processing_time_ms: options.processingTimeMs
  };
}

/**
 * Enhanced evidence source creation with comprehensive tracking
 * Requirements: 7.2 - Record source URLs, extraction timestamps, and confidence levels
 */
export function createEvidenceSource(
  url: string,
  sourceType: 'nix_ru' | 'official' | 'compatibility_db' | 'marketplace' | 'google_search' | 'other',
  claims: string[],
  evidenceSnippets: Record<string, string>,
  options: {
    confidence?: number;
    extractionMethod?: string;
    processingDurationMs?: number;
    retryCount?: number;
    validationStatus?: 'validated' | 'pending' | 'failed';
    qualityScore?: number;
  } = {}
): EvidenceSource {
  return {
    url,
    source_type: sourceType,
    claims,
    evidence_snippets_by_claim: evidenceSnippets,
    extracted_at: new Date().toISOString(),
    confidence: options.confidence || 0.8,
    extraction_method: options.extractionMethod || 'automated',
    processing_duration_ms: options.processingDurationMs,
    retry_count: options.retryCount || 0,
    validation_status: options.validationStatus || 'pending',
    quality_score: options.qualityScore
  };
}

/**
 * Calculates comprehensive confidence scores for all data fields
 * Requirements: 7.2 - Add confidence scoring for all extracted data fields
 */
export function calculateConfidenceScores(
  evidenceSources: EvidenceSource[],
  processingHistory: ProcessingHistoryEntry[],
  dataCompleteness: number
): ConfidenceScores {
  // Base confidence from source reliability
  const sourceConfidences = evidenceSources.map(s => s.confidence);
  const avgSourceConfidence = sourceConfidences.length > 0 
    ? sourceConfidences.reduce((sum, conf) => sum + conf, 0) / sourceConfidences.length 
    : 0;

  // Processing success rate impact
  const completedSteps = processingHistory.filter(h => h.status === 'completed').length;
  const totalSteps = processingHistory.length;
  const processingSuccessRate = totalSteps > 0 ? completedSteps / totalSteps : 0;

  // Source type weighting (NIX.ru and official sources get higher weight)
  const sourceTypeWeights = {
    'nix_ru': 1.0,
    'official': 0.95,
    'compatibility_db': 0.85,
    'marketplace': 0.7,
    'google_search': 0.6,
    'other': 0.5
  };

  const weightedSourceConfidence = evidenceSources.length > 0
    ? evidenceSources.reduce((sum, source) => {
        const weight = sourceTypeWeights[source.source_type] || 0.5;
        return sum + (source.confidence * weight);
      }, 0) / evidenceSources.length
    : 0;

  // Calculate field-specific confidences
  const modelConfidence = calculateFieldConfidence('model', evidenceSources, processingHistory);
  const logisticsConfidence = calculateFieldConfidence('logistics', evidenceSources, processingHistory);
  const compatibilityConfidence = calculateFieldConfidence('compatibility', evidenceSources, processingHistory);
  const faqConfidence = calculateFieldConfidence('faq', evidenceSources, processingHistory);

  // Overall confidence combines multiple factors
  const overallConfidence = (
    weightedSourceConfidence * 0.4 +
    processingSuccessRate * 0.3 +
    dataCompleteness * 0.2 +
    (modelConfidence + logisticsConfidence + compatibilityConfidence) / 3 * 0.1
  );

  return {
    model_name: modelConfidence,
    short_model: modelConfidence * 0.9, // Slightly lower for derived field
    logistics: logisticsConfidence,
    compatibility: compatibilityConfidence,
    faq: faqConfidence,
    overall: Math.min(overallConfidence, 1.0),
    data_completeness: dataCompleteness,
    source_reliability: weightedSourceConfidence
  };
}

/**
 * Calculates confidence for a specific data field based on evidence
 */
function calculateFieldConfidence(
  field: string,
  evidenceSources: EvidenceSource[],
  processingHistory: ProcessingHistoryEntry[]
): number {
  // Find sources that provide evidence for this field
  const relevantSources = evidenceSources.filter(source => 
    source.claims.includes(field) || 
    Object.keys(source.evidence_snippets_by_claim).includes(field)
  );

  if (relevantSources.length === 0) return 0;

  // Calculate weighted average confidence
  const totalConfidence = relevantSources.reduce((sum, source) => sum + source.confidence, 0);
  const avgConfidence = totalConfidence / relevantSources.length;

  // Boost confidence if multiple sources agree
  const multiSourceBonus = relevantSources.length > 1 ? Math.min(0.1, (relevantSources.length - 1) * 0.05) : 0;

  // Check processing history for field-specific issues
  const fieldProcessingIssues = processingHistory.filter(h => 
    h.status === 'failed' && h.data_changes?.includes(field)
  ).length;
  
  const processingPenalty = fieldProcessingIssues * 0.1;

  return Math.max(0, Math.min(1, avgConfidence + multiSourceBonus - processingPenalty));
}

/**
 * Calculates comprehensive quality metrics
 * Requirements: 7.5 - Add quality metrics monitoring
 */
export function calculateQualityMetrics(
  evidenceSources: EvidenceSource[],
  processingHistory: ProcessingHistoryEntry[],
  auditTrail: AuditTrailEntry[],
  requiredFields: string[],
  actualData: any
): QualityMetrics {
  // Data completeness: percentage of required fields that are populated
  const populatedFields = requiredFields.filter(field => {
    const value = getNestedValue(actualData, field);
    return value !== null && value !== undefined && value !== '';
  });
  const dataCompletenessScore = populatedFields.length / requiredFields.length;

  // Source reliability: weighted average of source confidences
  const sourceReliabilityScore = evidenceSources.length > 0
    ? evidenceSources.reduce((sum, source) => sum + source.confidence, 0) / evidenceSources.length
    : 0;

  // Validation pass rate: percentage of processing steps that completed successfully
  const completedSteps = processingHistory.filter(h => h.status === 'completed').length;
  const failedSteps = processingHistory.filter(h => h.status === 'failed').length;
  const totalSteps = processingHistory.length;
  const validationPassRate = totalSteps > 0 ? completedSteps / totalSteps : 0;

  // Processing efficiency: based on retry counts and processing times
  const totalRetries = evidenceSources.reduce((sum, source) => sum + (source.retry_count || 0), 0);
  const avgProcessingTime = processingHistory
    .filter(h => h.duration_ms)
    .reduce((sum, h, _, arr) => sum + (h.duration_ms! / arr.length), 0);
  
  // Lower retry count and faster processing = higher efficiency
  const processingEfficiency = Math.max(0, 1 - (totalRetries * 0.1) - Math.min(0.5, avgProcessingTime / 10000));

  // Audit completeness: percentage of processing steps with complete audit trail
  const stepsWithAudit = processingHistory.filter(step => 
    auditTrail.some(entry => entry.details.includes(step.step))
  ).length;
  const auditCompleteness = totalSteps > 0 ? stepsWithAudit / totalSteps : 0;

  // Failed validations and missing fields for detailed reporting
  const failedValidations = processingHistory
    .filter(h => h.status === 'failed')
    .map(h => `${h.step}: ${h.error_message || 'Unknown error'}`);

  const missingRequiredFields = requiredFields.filter(field => {
    const value = getNestedValue(actualData, field);
    return value === null || value === undefined || value === '';
  });

  return {
    data_completeness_score: dataCompletenessScore,
    source_reliability_score: sourceReliabilityScore,
    validation_pass_rate: validationPassRate,
    processing_efficiency: processingEfficiency,
    audit_completeness: auditCompleteness,
    last_calculated: new Date().toISOString(),
    total_sources_used: evidenceSources.length,
    failed_validations: failedValidations,
    missing_required_fields: missingRequiredFields
  };
}

/**
 * Helper function to get nested object values by dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Creates a comprehensive evidence block with full audit trail
 * Requirements: 7.3 - Maintain complete processing step history
 */
export function createEvidenceBlock(
  sources: EvidenceSource[],
  processingHistory: ProcessingHistoryEntry[],
  auditTrail: AuditTrailEntry[],
  groundingMetadata?: any[]
): EvidenceBlock {
  // Calculate quality metrics
  const requiredFields = ['model', 'brand', 'packaging_from_nix', 'printers_ru'];
  const qualityMetrics = calculateQualityMetrics(
    sources,
    processingHistory,
    auditTrail,
    requiredFields,
    {} // Will be populated with actual data when called
  );

  return {
    sources,
    grounding_metadata: groundingMetadata,
    processing_history: processingHistory,
    quality_metrics: qualityMetrics,
    audit_trail: auditTrail
  };
}

/**
 * Enhances an existing EnrichedItem with comprehensive audit trail
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5 - Complete audit trail implementation
 */
export function enhanceItemWithAuditTrail(
  item: EnrichedItem,
  processingHistory: ProcessingHistoryEntry[],
  auditTrail: AuditTrailEntry[]
): EnrichedItem {
  const jobRunId = generateJobRunId();
  const inputHash = createInputHash(item.input_raw);
  
  // Calculate processing duration
  const startTime = processingHistory.find(h => h.status === 'started')?.started_at;
  const endTime = processingHistory.find(h => h.status === 'completed' && h.completed_at)?.completed_at;
  const processingDurationMs = startTime && endTime 
    ? new Date(endTime).getTime() - new Date(startTime).getTime()
    : undefined;

  // Calculate retry count from evidence sources
  const retryCount = item.evidence.sources.reduce((sum, source) => sum + (source.retry_count || 0), 0);

  // Calculate overall quality score
  const confidenceScores = calculateConfidenceScores(
    item.evidence.sources,
    processingHistory,
    item.evidence.quality_metrics.data_completeness_score
  );

  // Update evidence block with enhanced audit trail
  const enhancedEvidence: EvidenceBlock = {
    ...item.evidence,
    processing_history: processingHistory,
    audit_trail: auditTrail,
    quality_metrics: calculateQualityMetrics(
      item.evidence.sources,
      processingHistory,
      auditTrail,
      ['model', 'brand', 'packaging_from_nix', 'printers_ru'],
      item.data
    )
  };

  // Update data with enhanced confidence scores
  const enhancedData = {
    ...item.data,
    confidence: confidenceScores
  };

  return {
    ...item,
    data: enhancedData,
    evidence: enhancedEvidence,
    job_run_id: jobRunId,
    input_hash: inputHash,
    ruleset_version: RULESET_VERSION,
    parser_version: PARSER_VERSION,
    processed_at: new Date().toISOString(),
    processing_duration_ms: processingDurationMs,
    retry_count: retryCount,
    quality_score: confidenceScores.overall,
    updated_at: Date.now()
  };
}

/**
 * Validates audit trail completeness
 * Requirements: 7.4 - Ensure complete traceability
 */
export function validateAuditTrailCompleteness(evidenceBlock: EvidenceBlock): {
  isComplete: boolean;
  missingElements: string[];
  completenessScore: number;
} {
  const missingElements: string[] = [];
  
  // Check required audit trail elements
  if (!evidenceBlock.processing_history || evidenceBlock.processing_history.length === 0) {
    missingElements.push('processing_history');
  }
  
  if (!evidenceBlock.audit_trail || evidenceBlock.audit_trail.length === 0) {
    missingElements.push('audit_trail');
  }
  
  if (!evidenceBlock.quality_metrics) {
    missingElements.push('quality_metrics');
  }
  
  if (!evidenceBlock.sources || evidenceBlock.sources.length === 0) {
    missingElements.push('evidence_sources');
  }

  // Check source completeness
  const incompleteSources = evidenceBlock.sources?.filter(source => 
    !source.extracted_at || 
    !source.confidence || 
    !source.extraction_method ||
    Object.keys(source.evidence_snippets_by_claim).length === 0
  ).length || 0;

  if (incompleteSources > 0) {
    missingElements.push(`${incompleteSources}_incomplete_sources`);
  }

  // Calculate completeness score
  const totalElements = 4; // processing_history, audit_trail, quality_metrics, sources
  const completeElements = totalElements - missingElements.length;
  const completenessScore = completeElements / totalElements;

  return {
    isComplete: missingElements.length === 0,
    missingElements,
    completenessScore
  };
}