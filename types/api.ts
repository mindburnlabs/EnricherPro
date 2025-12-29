import { ConsumableData, ConfidenceScores, EnrichedItem, ProcessingStep, ValidationStatus, ManualQueueEntry } from './domain';
import { ErrorCategory, ErrorSeverity, FailureReason } from './error';


export interface BatchProcessingProgress {
    totalItems: number;
    processedItems: number;
    successfulItems: number;
    failedItems: number;
    needsReviewItems: number;
    currentItem?: string;
    currentStep?: ProcessingStep;
    estimatedTimeRemaining: number; // seconds
    averageProcessingTime: number; // seconds per item
    startedAt: string;
    lastUpdatedAt: string;
    throughputPerMinute: number;
    errorRate: number; // percentage
}

export interface ProcessingStats {
    total: number;
    ok: number;
    needs_review: number;
    failed: number;
    pending: number;
    retrying: number;
    manual_queue: number;
    error_rate: number;
    average_processing_time: number;
    throughput_per_hour: number;
    critical_errors: number;
    retryable_errors: number;
    completion_rate: number;
    quality_score_average: number;
}

export interface AppState {
    items: EnrichedItem[];
    queue: string[];
    processingId: string | null;
    filterStatus: ValidationStatus | 'all';
    searchQuery: string;
    batchProgress?: BatchProcessingProgress;
    manualQueue: ManualQueueEntry[];
    retryQueue: string[];
    errorSummary?: {
        totalErrors: number;
        errorsByCategory: Record<ErrorCategory, number>;
        errorsBySeverity: Record<ErrorSeverity, number>;
        retryableErrors: number;
        criticalErrors: number;
    };
}

export interface PublicationReadinessScore {
    overall_score: number;
    component_scores: {
        required_fields: number;
        data_quality: number;
        russian_market: number;
        image_validation: number;
        source_reliability: number;
    };
    is_ready: boolean;
    blocking_issues: string[];
    recommendations: string[];
    confidence_level: 'high' | 'medium' | 'low';
    estimated_manual_effort: number;
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
