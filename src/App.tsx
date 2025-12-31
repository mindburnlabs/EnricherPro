
import React, { useState } from 'react';
import { ResearchComposer } from './components/Research/ResearchComposer';
import { RunProgress, StepStatus } from './components/Research/RunProgress';
// import { ReviewQueue } from './components/Research/ReviewQueue';
// Lazy load ReviewQueue
const ReviewQueue = React.lazy(() => import('./components/Research/ReviewQueue').then(module => ({ default: module.ReviewQueue })));

import { triggerResearch, getItems, approveItem } from './lib/api';
import { EnrichedItem } from './types/domain';
import { useTranslation } from 'react-i18next';
import { useResearchStream } from './hooks/useResearchStream';

import { SettingsView } from './components/Settings/SettingsView';
import { Settings } from 'lucide-react';

const App: React.FC = () => {
  const { t } = useTranslation('common');
  const { steps, items, status, startStream, reset } = useResearchStream();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  // React.useEffect(() => {
  //   localStorage.clear();
  //   console.log("System verified. Local storage cleared for production.");
  // }, []);

  const handleApprove = async (itemId: string) => {
    try {
      await approveItem(itemId);
      alert("Item approved! (Refresh to clear)");
    } catch (e) {
      console.error("Failed to approve", e);
      alert("Failed to approve item");
    }
  };

  const getApiKeys = () => ({
    firecrawl: localStorage.getItem('firecrawl_key') || undefined,
    google: localStorage.getItem('google_key') || undefined,
    openrouter: localStorage.getItem('openrouter_key') || undefined,
  });

  const handleSearch = async (input: string | string[], mode: 'fast' | 'balanced' | 'deep') => {
    reset();
    const inputs = Array.isArray(input) ? input : [input];
    const apiKeys = getApiKeys();

    try {
      for (const singleInput of inputs) {
        if (!singleInput.trim()) continue;

        // Trigger Server
        const res = await triggerResearch(singleInput, mode, { apiKeys });
        if (res.success && res.jobId) {
          startStream(res.jobId);
        } else {
          console.error("Failed to start job for", singleInput);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to start research: " + String(e));
    }
  };

  const handleMerge = async (item: EnrichedItem) => {
    const mode = 'balanced';
    reset();
    const apiKeys = getApiKeys();

    try {
      const res = await triggerResearch(item.data.mpn_identity.mpn || "unknown", mode, { forceRefresh: true, apiKeys });
      if (res.success && res.jobId) {
        startStream(res.jobId);
      }
    } catch (e) {
      alert("Merge failed: " + String(e));
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[80vh]">

        <header className="mb-12 text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700 relative w-full max-w-4xl">
          <div className="absolute top-0 right-0 flex gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:scale-105 transition-transform"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:scale-105 transition-transform"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>

          <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500">
            {t('app.title_labs')}
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            {t('app.subtitle')}
          </p>
        </header>


        <ResearchComposer onSubmit={handleSearch} isProcessing={status === 'running'} />

        <RunProgress steps={steps} isVisible={steps.length > 0} />

        {status === 'completed' && items.length > 0 && (
          <div className="mt-12 w-full max-w-4xl animate-in fade-in slide-in-from-bottom duration-700">
            <React.Suspense fallback={<div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />}>
              <ReviewQueue items={items} onApprove={handleApprove} onMerge={handleMerge} />
            </React.Suspense>
          </div>
        )}

        {/* Empty State after processing but no items? */}
        {status === 'completed' && items.length === 0 && (
          <p className="text-gray-400 mt-8">Processing complete. No actionable items found.</p>
        )}

        <SettingsView
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onThemeChange={toggleTheme}
          currentTheme={theme}
        />

      </div>
    </div>
  );
};

export default App;
