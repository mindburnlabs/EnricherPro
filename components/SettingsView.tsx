
import React, { useState, useEffect } from 'react';
import { Shield, Key, Save, AlertCircle, CheckCircle2, Loader2, XCircle, Activity, ExternalLink } from 'lucide-react';
import { validateFirecrawlApiKey } from '../services/firecrawlService';

const STORAGE_KEY = 'firecrawl_api_key';
const DIAGNOSTIC_KEY = 'fc-a4ab70dcfed54917b5df77890dfaca77';

const SettingsView: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Diagnostic state
  const [diagStatus, setDiagStatus] = useState<'idle' | 'checking' | 'success' | 'failed'>('idle');
  const [diagMessage, setDiagMessage] = useState('');

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

    try {
      const isValid = await validateFirecrawlApiKey(apiKey);

      if (isValid) {
        localStorage.setItem(STORAGE_KEY, apiKey);
        window.dispatchEvent(new Event('storage'));
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setErrorMessage("Invalid API Key. Please check your credentials at firecrawl.dev");
        setStatus('error');
      }
    } catch (err) {
      setErrorMessage((err as Error).message || "A network error occurred. Please check your connection.");
      setStatus('error');
    }
  };

  const runDiagnostic = async (keyToTest: string) => {
    setDiagStatus('checking');
    setDiagMessage('');
    
    try {
      const isValid = await validateFirecrawlApiKey(keyToTest);
      if (isValid) {
        setDiagStatus('success');
        setDiagMessage(`Success! Key validated against Firecrawl Team Endpoint. The key is active and ready for production use.`);
      } else {
        setDiagStatus('failed');
        setDiagMessage(`Invalid Key. The specified key did not pass validation. It may be expired, revoked, or incorrect.`);
      }
    } catch (err) {
      setDiagStatus('failed');
      setDiagMessage((err as Error).message || "Diagnostic failed due to a network error. Try disabling ad-blockers for this site.");
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-2xl mx-auto w-full h-full overflow-y-auto pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
          <Shield className="text-indigo-600" size={32} /> System Settings
        </h1>
        <p className="text-slate-500 font-medium">Configure external integrations and AI service parameters.</p>
      </div>

      <div className="space-y-8">
        {/* Main Key Configuration */}
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

        {/* Diagnostic Panel for the Requested Key */}
        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-slate-900/20">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-indigo-600/20 rounded-xl border border-indigo-500/20">
                    <Activity size={20} className="text-indigo-400" />
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-white">Project Key Diagnostics</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verification Engine</p>
                 </div>
              </div>
              <button 
                onClick={() => runDiagnostic(DIAGNOSTIC_KEY)}
                disabled={diagStatus === 'checking'}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
              >
                {diagStatus === 'checking' ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                {diagStatus === 'checking' ? 'Validating...' : 'Validate Test Key'}
              </button>
           </div>

           <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                 <span className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-widest">Target API Key</span>
                 <span className="text-[10px] font-mono text-indigo-300 bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-400/20">
                    {DIAGNOSTIC_KEY.substring(0, 10)}...{DIAGNOSTIC_KEY.substring(DIAGNOSTIC_KEY.length - 8)}
                 </span>
              </div>

              {diagStatus === 'idle' && (
                <div className="text-center py-4">
                   <p className="text-xs text-slate-400 font-medium italic">Click the validation button to check if the shared key is currently active.</p>
                </div>
              )}

              {diagStatus === 'checking' && (
                <div className="flex flex-col items-center gap-4 py-4 animate-pulse">
                   <Loader2 size={24} className="text-indigo-400 animate-spin" />
                   <p className="text-xs font-bold text-indigo-300">Contacting firecrawl.dev...</p>
                </div>
              )}

              {diagStatus === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-xl flex gap-4 animate-in zoom-in-95 duration-300">
                   <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
                   <div>
                      <h4 className="text-xs font-bold text-emerald-400 mb-1">Key Verified Successfully</h4>
                      <p className="text-xs text-emerald-100/70 leading-relaxed font-medium">{diagMessage}</p>
                   </div>
                </div>
              )}

              {diagStatus === 'failed' && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-xl flex gap-4 animate-in slide-in-from-top-2">
                   <XCircle className="text-rose-400 shrink-0" size={20} />
                   <div>
                      <h4 className="text-xs font-bold text-rose-400 mb-1">Validation Error</h4>
                      <p className="text-xs text-rose-100/70 leading-relaxed font-medium">{diagMessage}</p>
                   </div>
                </div>
              )}
           </div>

           <div className="mt-6 flex justify-between items-center">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Firecrawl V1 Endpoint API Support</span>
              <a 
                href="https://firecrawl.dev" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] font-bold text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-all"
              >
                Docs <ExternalLink size={10} />
              </a>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
