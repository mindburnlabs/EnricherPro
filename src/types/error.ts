export type FailureReason =
    | 'failed_parse_model'
    | 'failed_parse_type'
    | 'failed_parse_brand'
    | 'missing_nix_dimensions_weight'
    | 'nix_data_from_fallback'
    | 'low_confidence_nix_data'
    | 'low_confidence_agent_research'
    | 'no_oem_sources'
    | 'insufficient_ru_verification'
    | 'invalid_dimensions'
    | 'invalid_weight'
    | 'missing_valid_image'
    | 'image_validation_issues'
    | 'ru_eligibility_unknown'
    | 'compatibility_conflict'
    | 'incomplete_data'
    | 'api_rate_limit_exceeded'
    | 'external_service_timeout'
    | 'network_connectivity_error'
    | 'authentication_failed'
    | 'data_parsing_error'
    | 'validation_timeout';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory =
    | 'parsing_error'
    | 'data_quality'
    | 'external_service'
    | 'validation_failure'
    | 'network_error'
    | 'authentication_error'
    | 'timeout_error'
    | 'configuration_error';

import { ProcessingStep } from './domain.js';

export interface ErrorDetail {
    reason: FailureReason;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    context?: Record<string, any>;
    timestamp: string;
    step?: ProcessingStep;
    retryable: boolean;
    suggestedAction?: string;
    technicalDetails?: string;
}
