
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ImportView from './components/ImportView';
import ResultsView from './components/ResultsView';
import DetailView from './components/DetailView';
import SettingsView from './components/SettingsView';
import { EnrichedItem, ProcessingStats, ProcessingStep } from './types';
import { processItem } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'enricher_pro_db_v2';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const runQueue = async () => {
      if (processing || queue.length === 0) return;

      setProcessing(true);
      const input = queue[0];
      setQueue(prev => prev.slice(1));

      const tempId = uuidv4();
      const placeholder: EnrichedItem = {
          id: tempId,
          input_raw: input,
          data: {
              brand: null, consumable_type: null, model: null, short_model: null,
              yield: null, color: null, printers_ru: [], 
              // Fix: renamed property to match ConsumableData type and added missing required fields
              related_consumables: [],
              model_alias_short: null,
              has_chip: 'unknown',
              has_page_counter: 'unknown',
              packaging_from_nix: null, images: [], faq: []
          },
          evidence: { sources: [] },
          status: 'processing',
          current_step: 'searching',
          validation_errors: [],
          created_at: Date.now(),
          updated_at: Date.now()
      };

      setItems(prev => [placeholder, ...prev]);

      try {
        const result = await processItem(input, (step: ProcessingStep) => {
          setItems(prev => prev.map(item => item.id === tempId ? { ...item, current_step: step } : item));
        });
        
        setItems(prev => prev.map(item => item.id === tempId ? { ...result, id: tempId } : item));
      } catch (err) {
        setItems(prev => prev.map(item => 
            item.id === tempId ? { ...item, status: 'failed', validation_errors: [(err as Error).message] } : item
        ));
      } finally {
        setProcessing(false);
      }
    };

    runQueue();
  }, [queue, processing]);

  const handleImport = (inputs: string[]) => {
    setQueue(prev => [...prev, ...inputs]);
    setActiveTab('results');
  };

  const handleUpdateItem = (id: string, updates: Partial<EnrichedItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const stats: ProcessingStats = {
      total: items.length,
      ok: items.filter(i => i.status === 'ok').length,
      needs_review: items.filter(i => i.status === 'needs_review').length,
      failed: items.filter(i => i.status === 'failed').length,
      pending: queue.length + (processing ? 1 : 0)
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
                    onRetry={(id) => {
                        const itm = items.find(i => i.id === id);
                        if (itm) {
                          setItems(prev => prev.filter(i => i.id !== id));
                          setQueue(q => [itm.input_raw, ...q]);
                        }
                    }}
                    onCancelQueueItem={(idx) => setQueue(q => q.filter((_, i) => i !== idx))}
                />
            )}
            {activeTab === 'settings' && <SettingsView />}
          </>
      )}
    </Layout>
  );
};

export default App;
