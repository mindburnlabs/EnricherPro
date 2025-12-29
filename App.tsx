
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ImportView from './components/ImportView';
import ResultsView from './components/ResultsView';
import DetailView from './components/DetailView';
import SettingsView from './components/SettingsView';
import PublicationReadinessView from './components/PublicationReadinessView';
import { EnrichedItem, ProcessingStats } from './types';
import { initializeApiServices } from './services/apiIntegrationService';
import { useEnricherProcessor } from './hooks/useEnricherProcessor';

const STORAGE_KEY = 'enricher_pro_db_v2';
const OPENROUTER_STORAGE_KEY = 'openrouter_config';
const PRIMARY_ENGINE_KEY = 'primary_engine_preference';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialItems, setInitialItems] = useState<EnrichedItem[]>([]);

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

  // Engine Management
  const [processingEngine] = useState<'firecrawl'>('firecrawl');

  useEffect(() => {
    // Initialize API services explicitly
    initializeApiServices();
    // Default engine is now always firecrawl
  }, []);

  // Load Data from Storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        setInitialItems(savedData.items || savedData);
        // Note: Manual queue is handled internally by the hook's own storage logic,
        // but retryQueue and others were in the single object.
        // The hook doesn't accept initialRetryQueue prop yet but it's fine for now,
        // we can set it if needed or it will just start clean/rebuild.
        // Actually, let's just create the processor and if we needed to restore detailed state
        // we might miss retryQueue. 
        // For now, let's assume items status is source of truth for retry need.
      } catch (e) {
        console.error('Error loading saved data:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Initialize Processor Hook
  // We conditionally pass initialItems only when loaded.
  // Actually hook allows empty init, we can set it via useEffect.
  const processor = useEnricherProcessor({
    initialItems: [],
    processingEngine
  });

  // Sync loaded items to processor
  useEffect(() => {
    if (isLoaded && initialItems.length > 0) {
      processor.setItems(initialItems);

      // Also try to restore retryQueue if possible?
      // For now, relying on item status.
    }
  }, [isLoaded]);

  // Persist Data
  useEffect(() => {
    if (!isLoaded) return;

    const dataToSave = {
      items: processor.items,
      manualQueue: processor.manualQueue, // Hook manages this but we also sync to main DB? 
      // Actually hook manages 'enricher_manual_queue' separately. 
      // App.tsx formerly saved it all in 'enricher_pro_db_v2'.
      // To maintain backward compat or single source, let's keep saving it here.
      retryQueue: processor.retryQueue,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [processor.items, processor.manualQueue, processor.retryQueue, isLoaded]);

  // Handlers
  const handleImport = (inputs: string[]) => {
    processor.actions.handleImport(inputs);
    setActiveTab('results');
  };

  const handleUpdateItem = (id: string, updates: Partial<EnrichedItem>) => {
    processor.actions.handleUpdateItem(id, updates);
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to delete all history? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      processor.actions.clearAllHistory();
      setSelectedItem(null);
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Stats Logic
  const stats: ProcessingStats = {
    total: processor.items.length,
    ok: processor.items.filter(i => i.status === 'ok').length,
    needs_review: processor.items.filter(i => i.status === 'needs_review').length,
    failed: processor.items.filter(i => i.status === 'failed').length,
    pending: processor.queue.length + (processor.processing ? 1 : 0),
    retrying: processor.retryQueue.length,
    manual_queue: processor.manualQueue.length,
    error_rate: processor.items.length > 0 ? (processor.items.filter(i => i.status === 'failed').length / processor.items.length) * 100 : 0,
    average_processing_time: processor.items.length > 0 ?
      processor.items.reduce((sum, item) => sum + (item.processing_duration_ms || 0), 0) / processor.items.length : 0,
    throughput_per_hour: processor.batchProgress?.throughputPerMinute ? processor.batchProgress.throughputPerMinute * 60 : 0,
    critical_errors: processor.errorSummary.criticalErrors,
    retryable_errors: processor.errorSummary.retryableErrors,
    completion_rate: processor.items.length > 0 ? (processor.items.filter(i => i.status === 'ok').length / processor.items.length) * 100 : 0,
    quality_score_average: processor.items.length > 0 ?
      processor.items.reduce((sum, item) => sum + (item.quality_score || 0), 0) / processor.items.length : 0
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

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
              items={processor.items}
              queue={processor.queue}
              stats={stats}
              onViewItem={setSelectedItem}
              onRetry={processor.actions.handleRetryItem}
              onCancelQueueItem={(idx) => processor.setQueue(q => q.filter((_, i) => i !== idx))}
              batchProgress={processor.batchProgress}
              manualQueue={processor.manualQueue}
              onRemoveFromManualQueue={processor.actions.handleRemoveFromManualQueue}
              onBulkRetry={processor.actions.handleBulkRetry}
              errorSummary={processor.errorSummary}
            />
          )}
          {activeTab === 'publication' && (
            <PublicationReadinessView
              items={processor.items}
              onViewItem={setSelectedItem}
              onBulkApprove={processor.actions.handleBulkApprove}
              onUpdateItem={handleUpdateItem}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              theme={theme}
              onThemeChange={setTheme}
              onClearData={handleClearData}
            />
          )}
        </>
      )}
    </Layout>
  );
};

export default App;
