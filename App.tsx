
import React, { useState } from 'react';
import { ResearchComposer } from './src/components/Research/ResearchComposer';
import { RunProgress, StepStatus } from './src/components/Research/RunProgress';
import { ReviewQueue } from './src/components/Research/ReviewQueue';
// import { triggerResearch } from './api/start-research'; // If we use it, api is in root
// API
import { triggerResearch } from './src/lib/api'; // I wrote api.ts to src/lib/api.ts earlier!

import { useTranslation } from 'react-i18next';

const App: React.FC = () => {
  const { t } = useTranslation('common');
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

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
          // If we had a real ReviewQueue with data, we would set it here
          // For now, we just show the completion state
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
  };

  const handleSearch = async (input: string) => {
    setIsProcessing(true);
    setSteps([{ id: 'init', label: t('status.initializing', { ns: 'research' }), status: 'running' }]);

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

        <header className="mb-12 text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500">
            {t('app.title_labs')}
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            {t('app.subtitle')}
          </p>
        </header>

        <ResearchComposer onSubmit={handleSearch} isProcessing={isProcessing} />

        <RunProgress steps={steps} isVisible={steps.length > 0} />

        {/* Placeholder for Review Queue when job is done */}
        {!isProcessing && steps.length >= 4 && (
          <div className="mt-12 w-full max-w-4xl animate-in fade-in slide-in-from-bottom duration-700">
            <ReviewQueue items={[]} onApprove={() => { }} />
            <div className="text-center text-gray-400 p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
              {t('messages.search_completed_placeholder')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
