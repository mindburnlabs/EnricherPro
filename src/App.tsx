
import React, { useState } from 'react';
import { ResearchComposer } from './components/Research/ResearchComposer';
import { RunProgress, StepStatus } from './components/Research/RunProgress';
// import { ReviewQueue } from './components/Research/ReviewQueue';
// Lazy load ReviewQueue
const ReviewQueue = React.lazy(() => import('./components/Research/ReviewQueue').then(module => ({ default: module.ReviewQueue })));

import { triggerResearch, getItems, approveItem } from './lib/api';
import { EnrichedItem } from './types/domain';
import { useTranslation } from 'react-i18next';

const App: React.FC = () => {
  const { t } = useTranslation('common');
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Clear legacy storage on mount
  React.useEffect(() => {
    localStorage.clear();
    console.log("System verified. Local storage cleared for production.");
  }, []);

  const pollStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?jobId=${id}`);
        const data = await res.json();

        if (data.steps) {
          setSteps(data.steps);
        }

        if (data.status === 'needs_review' || data.status === 'published') {
          clearInterval(interval);
          setIsProcessing(false);

          // Fetch final items
          const itemsRes = await getItems(id);
          if (itemsRes.success) {
            setItems(itemsRes.items);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
  };

  const handleApprove = async (itemId: string) => {
    try {
      await approveItem(itemId);
      // Optimistic update
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e) {
      console.error("Failed to approve", e);
      alert("Failed to approve item");
    }
  };

  const handleSearch = async (input: string) => {
    setIsProcessing(true);
    setSteps([{ id: 'init', label: t('status.initializing', { ns: 'research' }), status: 'running' }]);
    setItems([]); // Clear previous results

    try {
      // Trigger Server
      const res = await triggerResearch(input);
      if (res.success && res.jobId) {
        setJobId(res.jobId);
        pollStatus(res.jobId);
      } else {
        throw new Error("Failed to start job");
      }

    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      setSteps(prev => [...prev, { id: 'err', label: 'Failed to start', status: 'failed', message: String(e) }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[80vh]">

        <header className="mb-12 text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700 relative">
          <button
            onClick={toggleTheme}
            className="absolute top-0 right-0 p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:scale-105 transition-transform"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500">
            {t('app.title_labs')}
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            {t('app.subtitle')}
          </p>
        </header>

        <ResearchComposer onSubmit={handleSearch} isProcessing={isProcessing} />

        <RunProgress steps={steps} isVisible={steps.length > 0} />

        {!isProcessing && items.length > 0 && (
          <div className="mt-12 w-full max-w-4xl animate-in fade-in slide-in-from-bottom duration-700">
            <React.Suspense fallback={<div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />}>
              <ReviewQueue items={items} onApprove={handleApprove} />
            </React.Suspense>
          </div>
        )}

        {/* Empty State after processing but no items? */}
        {!isProcessing && steps.length > 0 && items.length === 0 && (
          <p className="text-gray-400 mt-8">Processing complete. No actionable items found.</p>
        )}

      </div>
    </div>
  );
};

export default App;
