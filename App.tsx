
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ImportView from './components/ImportView';
import ResultsView from './components/ResultsView';
import DetailView from './components/DetailView';
import SettingsView from './components/SettingsView';
import PublicationReadinessView from './components/PublicationReadinessView';
import { EnrichedItem, ProcessingStats, ProcessingStep, BatchProcessingProgress, ManualQueueEntry } from './types';

import { orchestrationService } from './services/orchestrationService';
// remove import { processItem } from './services/geminiService'; -- handled by Replacement


import { createOpenRouterService, getOpenRouterService, OpenRouterConfig } from './services/openRouterService';
import {
  createErrorDetail,
  createBatchProcessingProgress,
  updateBatchProgress,
  updateCurrentProcessing,
  createManualQueueEntry,
  shouldRetryItem,
  scheduleRetry,
  getItemsReadyForRetry,
  generateErrorSummary,
  DEFAULT_RETRY_CONFIG
} from './services/errorHandlingService';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'enricher_pro_db_v2';
const OPENROUTER_STORAGE_KEY = 'openrouter_config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  // Enhanced state management
  const [batchProgress, setBatchProgress] = useState<BatchProcessingProgress | null>(null);
  const [manualQueue, setManualQueue] = useState<ManualQueueEntry[]>([]);
  const [retryQueue, setRetryQueue] = useState<string[]>([]);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [processingEngine, setProcessingEngine] = useState<'gemini' | 'openrouter'>('openrouter');

  // Initialize OpenRouter service on component mount and config changes
  useEffect(() => {
    const initializeOpenRouter = () => {
      const savedConfig = localStorage.getItem(OPENROUTER_STORAGE_KEY);
      if (savedConfig) {
        try {
          const config: OpenRouterConfig = JSON.parse(savedConfig);
          if (config.apiKey && config.model) {
            createOpenRouterService(config);
            setProcessingEngine('openrouter');
            console.log('OpenRouter service initialized with model:', config.model);
          } else {
            setProcessingEngine('gemini');
          }
        } catch (error) {
          console.warn('Failed to initialize OpenRouter service:', error);
          setProcessingEngine('gemini');
        }
      } else {
        setProcessingEngine('gemini');
      }
    };

    initializeOpenRouter();

    // Listen for storage changes to reinitialize service
    const handleStorageChange = () => {
      initializeOpenRouter();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        setItems(savedData.items || savedData); // Handle both old and new format
        setManualQueue(savedData.manualQueue || []);
        setRetryQueue(savedData.retryQueue || []);
      } catch (e) {
        console.error('Error loading saved data:', e);
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      items,
      manualQueue,
      retryQueue,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [items, manualQueue, retryQueue]);

  // Enhanced retry mechanism - check for items ready for retry
  useEffect(() => {
    const checkRetryQueue = () => {
      const readyItems = getItemsReadyForRetry(items);
      if (readyItems.length > 0 && !processing) {
        const itemToRetry = readyItems[0];
        console.log(`Retrying item: ${itemToRetry.id}`);

        // Remove from items and add back to queue
        setItems(prev => prev.filter(item => item.id !== itemToRetry.id));
        setQueue(prev => [itemToRetry.input_raw, ...prev]);
        setRetryQueue(prev => prev.filter(id => id !== itemToRetry.id));
      }
    };

    const retryInterval = setInterval(checkRetryQueue, 5000); // Check every 5 seconds
    return () => clearInterval(retryInterval);
  }, [items, processing]);

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
      const processingStart = Date.now();
      setProcessingStartTime(processingStart);

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
        // Use OpenRouter service if available, fallback to Gemini
        let result: EnrichedItem;
        const openRouterService = getOpenRouterService();

        if (processingEngine === 'openrouter' && openRouterService) {
          console.log('Processing with OpenRouter service');
          result = await openRouterService.processItem(input, (step: ProcessingStep) => {
            setItems(prev => prev.map(item => item.id === tempId ? { ...item, current_step: step } : item));

            // Update batch progress with current step
            if (batchProgress) {
              setBatchProgress(prev => prev ? updateCurrentProcessing(prev, tempId, step) : null);
            }
          });
        } else {
          console.log('Processing with Gemini service (fallback)');
          // Use Orchestration Service (SOTA Pipeline)
          result = await orchestrationService.processItem(input, (step: ProcessingStep) => {
            setItems(prev => prev.map(item =>
              item.id === tempId
                ? { ...item, current_step: step }
                : item
            ));

            if (batchProgress) {
              setBatchProgress(prev => prev ? updateCurrentProcessing(prev, tempId, step) : null);
            }
          });
        }

        const processingEnd = Date.now();
        const processingTime = processingEnd - processingStart;

        // Enhanced result processing with error handling
        const enhancedResult = await processItemResult(result, tempId, processingTime);

        setItems(prev => prev.map(item => item.id === tempId ? enhancedResult : item));

        // Update batch progress
        if (batchProgress) {
          setBatchProgress(prev => prev ? updateBatchProgress(prev, enhancedResult, processingTime) : null);
        }

      } catch (err) {
        const processingEnd = Date.now();
        const processingTime = processingEnd - processingStart;

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
          const manualEntry = createManualQueueEntry(
            finalItem,
            finalItem.data,
            ['model', 'brand', 'packaging_from_nix'],
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

        // Clear batch progress if queue is empty
        if (queue.length <= 1) {
          setBatchProgress(null);
        }
      }
    };

    runQueue();
  }, [queue, processing, batchProgress]);

  // Enhanced item result processing with error analysis
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
    // Initialize batch progress for multiple items
    if (inputs.length > 1) {
      setBatchProgress(createBatchProcessingProgress(inputs.length));
    }

    setQueue(prev => [...prev, ...inputs]);
    setActiveTab('results');
  };

  const handleUpdateItem = (id: string, updates: Partial<EnrichedItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // Enhanced retry functionality
  const handleRetryItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      // Remove from current items and manual queue
      setItems(prev => prev.filter(i => i.id !== id));
      setManualQueue(prev => prev.filter(entry => entry.itemId !== id));
      setRetryQueue(prev => prev.filter(itemId => itemId !== id));

      // Add back to processing queue
      setQueue(q => [item.input_raw, ...q]);
    }
  };

  // Enhanced manual queue management
  const handleRemoveFromManualQueue = (itemId: string) => {
    setManualQueue(prev => prev.filter(entry => entry.itemId !== itemId));
  };

  const handleBulkRetry = (itemIds: string[]) => {
    itemIds.forEach(id => handleRetryItem(id));
  };

  // Publication readiness handlers
  const handleBulkApprove = (itemIds: string[]) => {
    // Update items to approved status
    setItems(prev => prev.map(item =>
      itemIds.includes(item.id)
        ? { ...item, status: 'ok', updated_at: Date.now() }
        : item
    ));
  };

  // Enhanced statistics calculation
  const errorSummary = generateErrorSummary(items);

  const stats: ProcessingStats = {
    total: items.length,
    ok: items.filter(i => i.status === 'ok').length,
    needs_review: items.filter(i => i.status === 'needs_review').length,
    failed: items.filter(i => i.status === 'failed').length,
    pending: queue.length + (processing ? 1 : 0),
    retrying: retryQueue.length,
    manual_queue: manualQueue.length,
    error_rate: items.length > 0 ? (items.filter(i => i.status === 'failed').length / items.length) * 100 : 0,
    average_processing_time: items.length > 0 ?
      items.reduce((sum, item) => sum + (item.processing_duration_ms || 0), 0) / items.length : 0,
    throughput_per_hour: batchProgress?.throughputPerMinute ? batchProgress.throughputPerMinute * 60 : 0,
    critical_errors: errorSummary.criticalErrors,
    retryable_errors: errorSummary.retryableErrors,
    completion_rate: items.length > 0 ? (items.filter(i => i.status === 'ok').length / items.length) * 100 : 0,
    quality_score_average: items.length > 0 ?
      items.reduce((sum, item) => sum + (item.quality_score || 0), 0) / items.length : 0
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {selectedItem ? (
        <DetailView
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={handleUpdateItem}
        />
      ) : (
        <>
          {activeTab === 'import' && <ImportView onImport={handleImport} />}
          {activeTab === 'results' && (
            <ResultsView
              items={items}
              queue={queue}
              stats={stats}
              onViewItem={setSelectedItem}
              onRetry={handleRetryItem}
              onCancelQueueItem={(idx) => setQueue(q => q.filter((_, i) => i !== idx))}
              batchProgress={batchProgress}
              manualQueue={manualQueue}
              onRemoveFromManualQueue={handleRemoveFromManualQueue}
              onBulkRetry={handleBulkRetry}
              errorSummary={errorSummary}
            />
          )}
          {activeTab === 'publication' && (
            <PublicationReadinessView
              items={items}
              onViewItem={setSelectedItem}
              onBulkApprove={handleBulkApprove}
              onUpdateItem={handleUpdateItem}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              theme={theme}
              onThemeChange={setTheme}
              onClearData={() => {
                if (window.confirm('Are you sure you want to delete all history? This cannot be undone.')) {
                  localStorage.removeItem(STORAGE_KEY);
                  setItems([]);
                  setQueue([]);
                  setManualQueue([]);
                  setRetryQueue([]);
                  setBatchProgress(null);
                  setSelectedItem(null);
                  window.dispatchEvent(new Event('storage'));
                }
              }}
            />
          )}
        </>
      )}
    </Layout>
  );
};

export default App;
