
import React, { useState, useEffect } from 'react';
import { Shield, Key, Save, AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { validateFirecrawlApiKey } from '../services/firecrawlService';

const STORAGE_KEY = 'firecrawl_api_key';

const SettingsView: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setApiKey(saved);
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
        setErrorMessage("API Key cannot be empty");
        setStatus('error');
        return;
    }

    setStatus('validating');
    setErrorMessage('');

    const isValid = await validateFirecrawlApiKey(apiKey);

    if (isValid) {
      localStorage.setItem(STORAGE_KEY, apiKey);
      // Dispatch storage event so Layout can update its status dot
      window.dispatchEvent(new Event('storage'));
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setErrorMessage("Invalid API Key. Please check your credentials at firecrawl.dev");
      setStatus('error');
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-2xl mx-auto w-full h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
          <Shield className="text-indigo-600" size={32} /> System Settings
        </h1>
        <p className="text-slate-500 font-medium">Configure external integrations and AI service parameters.</p>
      </div>

      <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div className="p-8 space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Key size={18} className="text-indigo-400" />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Firecrawl API (Live Scraper)</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 px-1">
                  API KEY (V2)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                      setApiKey(e.target.value);
                      if (status === 'error') setStatus('idle');
                  }}
                  className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl focus:bg-white focus:outline-none font-mono text-sm transition-all ${
                    status === 'error' ? 'border-rose-200 focus:border-rose-500' : 'border-slate-50 focus:border-indigo-500'
                  }`}
                  placeholder="fc-..."
                />
                <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed">
                  Your key is stored locally in your browser. Get yours at <a href="https://firecrawl.dev" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">firecrawl.dev</a>.
                </p>
              </div>

              {status === 'error' && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                  <XCircle className="text-rose-600 shrink-0" size={20} />
                  <p className="text-xs text-rose-800 font-bold leading-snug">
                    {errorMessage}
                  </p>
                </div>
              )}

              <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex gap-4">
                <AlertCircle className="text-indigo-600 shrink-0" size={20} />
                <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                  This key enables the <strong>Smart Research</strong> phase, allowing the AI to pull live specs from NIX.ru and manufacturer sites.
                </p>
              </div>
            </div>
          </section>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={status === 'validating'}
              className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg ${
                status === 'saved' 
                ? 'bg-emerald-500 text-white shadow-emerald-200' 
                : status === 'validating'
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {status === 'validating' ? <Loader2 size={18} className="animate-spin" /> : status === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
              {status === 'validating' ? 'Verifying Key...' : status === 'saved' ? 'Key Verified & Saved' : 'Save & Validate Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
