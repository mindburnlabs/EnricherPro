
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { orchestrationService } from '../services/orchestrationService';
import { EnrichedItem, ProcessingStep, BatchProcessingProgress, ManualQueueEntry } from '../types';
import {
    createErrorDetail,
    createBatchProcessingProgress,
    updateBatchProgress,
    updateCurrentProcessing,
    createManualQueueEntry,
    shouldRetryItem,
    scheduleRetry,
    getItemsReadyForRetry,
    generateErrorSummary
} from '../services/errorHandlingService';

export interface UseEnricherProcessorProps {
    initialItems?: EnrichedItem[];
    processingEngine?: 'gemini' | 'openrouter' | 'firecrawl';
}

export function useEnricherProcessor({ initialItems = [], processingEngine = 'gemini' }: UseEnricherProcessorProps = {}) {
    const [items, setItems] = useState<EnrichedItem[]>(initialItems);
    const [queue, setQueue] = useState<string[]>([]);
    const [manualQueue, setManualQueue] = useState<ManualQueueEntry[]>([]);
    const [processing, setProcessing] = useState(false);
    const [currentProcessingItem, setCurrentProcessingItem] = useState<string | null>(null);
    const [batchProgress, setBatchProgress] = useState<BatchProcessingProgress | null>(null);
    const [retryQueue, setRetryQueue] = useState<string[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);

    // Engine ref to access current value in async callbacks without dependency issues
    const engineRef = useRef(processingEngine);
    useEffect(() => {
        engineRef.current = processingEngine;
    }, [processingEngine]);

    // Load manual queue from local storage on mount
    useEffect(() => {
        try {
            const storedQueue = localStorage.getItem('enricher_manual_queue');
            if (storedQueue) {
                setManualQueue(JSON.parse(storedQueue));
            }
        } catch (e) {
            console.error("Failed to load manual queue from local storage", e);
        }
    }, []);

    // Save manual queue to local storage on change
    useEffect(() => {
        localStorage.setItem('enricher_manual_queue', JSON.stringify(manualQueue));
    }, [manualQueue]);

    // Enhanced retry mechanism - check for items ready for retry
    useEffect(() => {
        const checkRetryQueue = () => {
            const readyItems = getItemsReadyForRetry(items);
            if (readyItems.length > 0 && !processing) {
                // Take just the first one to start the cycle
                const itemToRetry = readyItems[0];

                // Remove from items (will be re-added as placeholders in processItem logic or here?)
                // App.tsx logic: Remove from items, add input back to queue, remove from retryQueue
                setItems(prev => prev.filter(item => item.id !== itemToRetry.id));
                setQueue(prev => [itemToRetry.input_raw, ...prev]);
                setRetryQueue(prev => prev.filter(id => id !== itemToRetry.id));
            }
        };

        const retryInterval = setInterval(checkRetryQueue, 5000); // Check every 5 seconds
        return () => clearInterval(retryInterval);
    }, [items, processing]);

    // Main processing effect
    useEffect(() => {
        const runQueue = async () => {
            if (processing || queue.length === 0) return;

            setProcessing(true);
            const input = queue[0];
            setQueue(prev => prev.slice(1));

            // Initialize batch progress if not already set
            if (!batchProgress && queue.length > 0) {
                setBatchProgress(createBatchProcessingProgress(queue.length + 1));
            }

            const tempId = uuidv4();
            const startTime = Date.now();
            setProcessingStartTime(startTime);
            setCurrentProcessingItem(tempId);

            const placeholder: EnrichedItem = {
                id: tempId,
                input_raw: input,
                data: {
                    brand: null, consumable_type: 'unknown', model: null, short_model: null,
                    yield: null, color: null, printers_ru: [],
                    supplier_title_raw: input,
                    title_norm: input,
                    automation_status: 'needs_review',
                    publish_ready: false,
                    mpn_identity: { mpn: '', variant_flags: { chip: false, counterless: false, high_yield: false, kit: false }, canonical_model_name: '' },
                    compatible_printers_ru: [],
                    compatible_printers_unverified: [],
                    sources: [],
                    images: [],
                    packaging_from_nix: null,
                    model_alias_short: null,
                    has_chip: 'unknown',
                    has_page_counter: 'unknown',
                    related_consumables_full: [],
                    related_consumables_display: [],
                    faq: []
                },
                evidence: {
                    sources: [],
                    processing_history: [],
                    quality_metrics: {
                        data_completeness_score: 0,
                        source_reliability_score: 0,
                        validation_pass_rate: 0,
                        processing_efficiency: 0,
                        audit_completeness: 0,
                        last_calculated: new Date().toISOString(),
                        total_sources_used: 0,
                        failed_validations: [],
                        missing_required_fields: []
                    },
                    audit_trail: []
                },
                status: 'needs_review', // Temporary status during processing
                current_step: 'searching',
                validation_errors: [],
                error_details: [],
                failure_reasons: [],
                retry_count: 0,
                is_retryable: false,
                created_at: Date.now(),
                updated_at: Date.now(),
                input_hash: '',
                ruleset_version: '2.1.0',
                parser_version: '1.5.0',
                processed_at: new Date().toISOString()
            };

            setItems(prev => [placeholder, ...prev]);

            // Update batch progress with current item
            if (batchProgress) {
                setBatchProgress(prev => prev ? updateCurrentProcessing(prev, tempId, 'searching') : null);
            }

            try {
                const result = await orchestrationService.processItem(
                    input,
                    (step: ProcessingStep) => {
                        setItems(prev => prev.map(item => item.id === tempId ? { ...item, current_step: step } : item));

                        // Update batch progress with current step
                        if (batchProgress) {
                            setBatchProgress(prev => prev ? updateCurrentProcessing(prev, tempId, step) : null);
                        }
                    },
                    { engine: engineRef.current }
                );

                const processingEnd = Date.now();
                const processingTime = processingEnd - startTime;

                // Enhanced result processing with error handling
                const enhancedResult = await processItemResult(result, tempId, processingTime);

                setItems(prev => prev.map(item => item.id === tempId ? enhancedResult : item));

                // Update batch progress
                if (batchProgress) {
                    setBatchProgress(prev => prev ? updateBatchProgress(prev, enhancedResult, processingTime) : null);
                }

            } catch (err) {
                const processingEnd = Date.now();
                const processingTime = processingEnd - startTime;

                console.error('Processing error:', err);

                // Create detailed error information
                const errorDetail = createErrorDetail(
                    'external_service_timeout',
                    (err as Error).message,
                    { input, processingTime },
                    'finalizing',
                    (err as Error).stack
                );

                const failedItem: EnrichedItem = {
                    ...placeholder,
                    status: 'failed',
                    validation_errors: [(err as Error).message],
                    error_details: [errorDetail],
                    failure_reasons: ['external_service_timeout'],
                    retry_count: 0,
                    is_retryable: shouldRetryItem({ ...placeholder, error_details: [errorDetail] }),
                    processing_duration_ms: processingTime,
                    updated_at: Date.now()
                };

                // Schedule for retry if retryable
                const finalItem = failedItem.is_retryable ? scheduleRetry(failedItem) : failedItem;

                setItems(prev => prev.map(item => item.id === tempId ? finalItem : item));

                // Add to retry queue if retryable
                if (finalItem.is_retryable) {
                    setRetryQueue(prev => [...prev, finalItem.id]);
                }

                // Add to manual queue if not retryable or critical error
                if (!finalItem.is_retryable || errorDetail.severity === 'critical') {
                    const missingFields = ['unknown_failure'];
                    const manualEntry = createManualQueueEntry(
                        finalItem,
                        finalItem.data,
                        missingFields,
                        errorDetail.severity === 'critical' ? 'high' : 'medium'
                    );
                    setManualQueue(prev => [...prev, manualEntry]);
                }

                // Update batch progress
                if (batchProgress) {
                    setBatchProgress(prev => prev ? updateBatchProgress(prev, finalItem, processingTime) : null);
                }
            } finally {
                setProcessing(false);
                setProcessingStartTime(null);
                setCurrentProcessingItem(null);

                // Clear batch progress if queue is empty
                if (queue.length <= 1) {
                    setBatchProgress(prev => (prev && prev.processed >= prev.total) ? null : prev);
                }
            }
        };

        runQueue();
    }, [queue, processing, batchProgress]);

    const processItemResult = async (result: EnrichedItem, tempId: string, processingTime: number): Promise<EnrichedItem> => {
        const errorDetails: any[] = [];
        const failureReasons: any[] = [];

        // Convert validation errors to structured error details
        if (result.validation_errors && result.validation_errors.length > 0) {
            result.validation_errors.forEach(error => {
                // Parse error messages to determine failure reasons
                let reason: any = 'incomplete_data';

                if (error.includes('missing_nix_dimensions_weight')) reason = 'missing_nix_dimensions_weight';
                else if (error.includes('nix_data_from_fallback')) reason = 'nix_data_from_fallback';
                else if (error.includes('low_confidence_nix_data')) reason = 'low_confidence_nix_data';
                else if (error.includes('ru_eligibility_unknown')) reason = 'ru_eligibility_unknown';
                else if (error.includes('missing_valid_image')) reason = 'missing_valid_image';
                else if (error.includes('compatibility_conflict')) reason = 'compatibility_conflict';
                else if (error.includes('Could not extract consumable model')) reason = 'failed_parse_model';
                else if (error.includes('Could not determine printer brand')) reason = 'failed_parse_brand';

                const errorDetail = createErrorDetail(
                    reason,
                    error,
                    { processingTime },
                    result.current_step,
                    `Validation error during ${result.current_step || 'processing'}`
                );

                errorDetails.push(errorDetail);
                failureReasons.push(reason);
            });
        }

        // Determine if item should be retried
        const enhancedResult = {
            ...result,
            id: tempId,
            error_details: errorDetails,
            failure_reasons: failureReasons,
            retry_count: 0,
            is_retryable: errorDetails.length > 0 ? shouldRetryItem({ ...result, error_details: errorDetails }) : false,
            processing_duration_ms: processingTime,
            updated_at: Date.now()
        };

        // Handle failed items
        if (result.status === 'failed' || result.status === 'needs_review') {
            // Schedule for retry if retryable
            if (enhancedResult.is_retryable) {
                const scheduledItem = scheduleRetry(enhancedResult);
                setRetryQueue(prev => [...prev, scheduledItem.id]);
                return scheduledItem;
            }

            // Add to manual queue if not retryable or needs review
            const missingFields = [];
            if (!result.data.model) missingFields.push('model');
            if (!result.data.brand) missingFields.push('brand');
            if (!result.data.packaging_from_nix) missingFields.push('packaging_from_nix');
            if (!result.data.images || result.data.images.length === 0) missingFields.push('images');

            const priority = errorDetails.some(e => e.severity === 'critical') ? 'high' :
                errorDetails.some(e => e.severity === 'high') ? 'medium' : 'low';

            const manualEntry = createManualQueueEntry(
                enhancedResult,
                result.data,
                missingFields,
                priority
            );

            setManualQueue(prev => [...prev, manualEntry]);
        }

        return enhancedResult;
    };

    const handleImport = (inputs: string[]) => {
        if (inputs.length > 0) {
            if (inputs.length > 1 || !batchProgress) {
                setBatchProgress(createBatchProcessingProgress(inputs.length));
            } else if (batchProgress) {
                setBatchProgress(prev => prev ? ({ ...prev, total: prev.total + inputs.length }) : createBatchProcessingProgress(inputs.length));
            }
            setQueue(prev => [...prev, ...inputs]);
        }
    };

    const handleUpdateItem = (id: string, updates: Partial<EnrichedItem>) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleRetryItem = (id: string) => {
        const item = items.find(i => i.id === id);
        if (item) {
            setItems(prev => prev.filter(i => i.id !== id));
            setManualQueue(prev => prev.filter(entry => entry.itemId !== id));
            setRetryQueue(prev => prev.filter(itemId => itemId !== id));
            setQueue(q => [item.input_raw, ...q]);
        }
    };

    const handleRemoveFromManualQueue = (itemId: string) => {
        setManualQueue(prev => prev.filter(entry => entry.itemId !== itemId));
    };

    const handleBulkRetry = (itemIds: string[]) => {
        itemIds.forEach(id => handleRetryItem(id));
    };

    const handleBulkApprove = (itemIds: string[]) => {
        setItems(prev => prev.map(item =>
            itemIds.includes(item.id)
                ? { ...item, status: 'ok', updated_at: Date.now() }
                : item
        ));
    };

    const clearAllHistory = () => {
        setItems([]);
        setQueue([]);
        setManualQueue([]);
        setRetryQueue([]);
        setBatchProgress(null);
    };

    const errorSummary = generateErrorSummary(items);

    return {
        items,
        setItems,
        queue,
        setQueue,
        manualQueue,
        setManualQueue,
        batchProgress,
        setBatchProgress,
        retryQueue,
        setRetryQueue,
        processing,
        currentProcessingItem,
        errorSummary,
        actions: {
            handleImport,
            handleUpdateItem,
            handleRetryItem,
            handleRemoveFromManualQueue,
            handleBulkRetry,
            handleBulkApprove,
            clearAllHistory
        }
    };
}
