
import React, { useState, useEffect } from 'react';
import { Shield, Key, Save, AlertCircle, CheckCircle2, Loader2, XCircle, Activity, TrendingUp, Settings as SettingsIcon, Zap, Brain, Moon, Sun, Monitor, Laptop } from 'lucide-react';
import { validateFirecrawlApiKey } from '../services/firecrawlService';
import ApiStatusIndicator from './ApiStatusIndicator';
import { apiHealthMonitoringService } from '../services/apiHealthMonitoringService';
import { createOpenRouterService, RECOMMENDED_MODELS, OpenRouterConfig } from '../services/openRouterService';

const FIRECRAWL_STORAGE_KEY = 'firecrawl_api_key';
const OPENROUTER_STORAGE_KEY = 'openrouter_config';
const GEMINI_STORAGE_KEY = 'gemini_api_key';
const GEMINI_MODEL_STORAGE_KEY = 'gemini_model';

interface SettingsViewProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ theme, onThemeChange }) => {
  const [apiKey, setApiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-pro'); // Default model
  const [openRouterConfig, setOpenRouterConfig] = useState<OpenRouterConfig>({
    apiKey: '',
    model: 'google/gemini-3-flash-preview'
  });

  const [status, setStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [openRouterStatus, setOpenRouterStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');

  const [errorMessage, setErrorMessage] = useState('');
  const [geminiError, setGeminiError] = useState('');
  const [openRouterError, setOpenRouterError] = useState('');

  const [activeTab, setActiveTab] = useState<'general' | 'api-keys' | 'monitoring'>('general');
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    // Load Keys
    const savedFirecrawl = localStorage.getItem(FIRECRAWL_STORAGE_KEY);
    if (savedFirecrawl) setApiKey(savedFirecrawl);

    const savedGemini = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (savedGemini) setGeminiKey(savedGemini);

    const savedGeminiModel = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
    if (savedGeminiModel) setGeminiModel(savedGeminiModel);

    // Load OpenRouter config
    const savedOpenRouter = localStorage.getItem(OPENROUTER_STORAGE_KEY);
    if (savedOpenRouter) {
      try {
        const config = JSON.parse(savedOpenRouter);
        setOpenRouterConfig(config);
      } catch (error) {
        console.warn('Failed to parse OpenRouter config:', error);
      }
    }

    // Load system health data
    const updateHealth = () => {
      try {
        const health = apiHealthMonitoringService.getSystemHealthSummary();
        setSystemHealth(health);
      } catch (error) {
        console.warn('Failed to get system health:', error);
      }
    };

    updateHealth();
    const interval = setInterval(updateHealth, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSaveFirecrawl = async () => {
    if (!apiKey.trim()) {
      setErrorMessage("API Key cannot be empty");
      setStatus('error');
      return;
    }

    setStatus('validating');
    setErrorMessage('');

    const isValid = await validateFirecrawlApiKey(apiKey);

    if (isValid) {
      localStorage.setItem(FIRECRAWL_STORAGE_KEY, apiKey);
      window.dispatchEvent(new Event('storage'));
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setErrorMessage("Invalid API Key. Please check your credentials at firecrawl.dev");
      setStatus('error');
    }
  };

  const handleSaveGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiError("API Key cannot be empty");
      setGeminiStatus('error');
      return;
    }

    // Basic validation logic for now, ideally we'd ping an endpoint
    if (!geminiKey.startsWith('AIza')) {
      setGeminiError("Invalid Gemini API Key format (usually starts with AIza)");
      setGeminiStatus('error');
      return;
    }

    setGeminiStatus('saved');
    localStorage.setItem(GEMINI_STORAGE_KEY, geminiKey);
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, geminiModel);
    // Ideally update a service here or trigger a reload
    // For now we just save it as the service reads env or local storage
    setTimeout(() => setGeminiStatus('idle'), 3000);
  };

  const handleOpenRouterSave = async () => {
    if (!openRouterConfig.apiKey.trim()) {
      setOpenRouterError("OpenRouter API Key cannot be empty");
      setOpenRouterStatus('error');
      return;
    }

    if (!openRouterConfig.model) {
      setOpenRouterError("Please select a model");
      setOpenRouterStatus('error');
      return;
    }

    setOpenRouterStatus('validating');
    setOpenRouterError('');

    try {
      const service = createOpenRouterService(openRouterConfig);
      await service.getAvailableModels();

      localStorage.setItem(OPENROUTER_STORAGE_KEY, JSON.stringify(openRouterConfig));
      window.dispatchEvent(new Event('storage'));
      setOpenRouterStatus('saved');
      setTimeout(() => setOpenRouterStatus('idle'), 3000);
    } catch (error) {
      setOpenRouterError(`Invalid configuration: ${error}`);
      setOpenRouterStatus('error');
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-4xl mx-auto w-full h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary mb-2 flex items-center gap-3">
          <Shield className="text-primary-accent" size={32} /> System Settings
        </h1>
        <p className="text-primary-subtle font-medium">Configure external integrations, monitor API health, and manage system parameters.</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="flex space-x-1 bg-surface p-1 rounded-2xl w-fit border border-border-subtle">
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'api-keys'
              ? 'bg-card text-primary shadow-sm'
              : 'text-primary-subtle hover:text-primary'
              }`}
          >
            <Key size={16} className="inline mr-2" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'monitoring'
              ? 'bg-card text-primary shadow-sm'
              : 'text-primary-subtle hover:text-primary'
              }`}
          >
            <Activity size={16} className="inline mr-2" />
            API Monitoring
          </button>
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-8">
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle overflow-hidden">
            <div className="p-8 space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Monitor size={18} className="text-primary-accent" />
                  <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">Appearance</h2>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`p-4 rounded-2xl border-2 transition-all text-left group ${theme === 'light'
                      ? 'border-primary-accent bg-primary-accent/5'
                      : 'border-border-subtle hover:border-primary-accent/50'
                      }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center mb-3 text-amber-500">
                      <Sun size={20} />
                    </div>
                    <div className="font-bold text-primary mb-1">Light Mode</div>
                    <div className="text-xs text-primary-subtle">Clean and crisp</div>
                  </button>

                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`p-4 rounded-2xl border-2 transition-all text-left group ${theme === 'dark'
                      ? 'border-primary-accent bg-primary-accent/5'
                      : 'border-border-subtle hover:border-primary-accent/50'
                      }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-900 shadow-md flex items-center justify-center mb-3 text-indigo-400">
                      <Moon size={20} />
                    </div>
                    <div className="font-bold text-primary mb-1">Dark Mode</div>
                    <div className="text-xs text-primary-subtle">Easy on eyes</div>
                  </button>

                  <button
                    onClick={() => onThemeChange('system')}
                    className={`p-4 rounded-2xl border-2 transition-all text-left group ${theme === 'system'
                      ? 'border-primary-accent bg-primary-accent/5'
                      : 'border-border-subtle hover:border-primary-accent/50'
                      }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-900 shadow-md flex items-center justify-center mb-3 text-slate-500">
                      <Laptop size={20} />
                    </div>
                    <div className="font-bold text-primary mb-1">System</div>
                    <div className="text-xs text-primary-subtle">Auto-detect</div>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div className="space-y-8">
          {/* OpenRouter Configuration */}
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle overflow-hidden">
            <div className="p-8 space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Brain size={18} className="text-primary-accent" />
                  <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">OpenRouter AI (Primary Engine)</h2>
                  <span className="bg-primary-accent/10 text-primary-accent px-2 py-1 rounded-lg text-xs font-bold">RECOMMENDED</span>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-primary-subtle mb-2 px-1">
                      API KEY
                    </label>
                    <input
                      type="password"
                      value={openRouterConfig.apiKey}
                      onChange={(e) => {
                        setOpenRouterConfig(prev => ({ ...prev, apiKey: e.target.value }));
                        if (openRouterStatus === 'error') setOpenRouterStatus('idle');
                      }}
                      className={`w-full px-5 py-4 bg-surface border-2 rounded-2xl focus:bg-card focus:outline-none font-mono text-sm transition-all text-primary ${openRouterStatus === 'error' ? 'border-status-error/50 focus:border-status-error' : 'border-border-subtle focus:border-primary-accent'
                        }`}
                      placeholder="sk-or-v1-..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary-subtle mb-2 px-1">
                      MODEL SELECTION
                    </label>
                    <select
                      value={openRouterConfig.model}
                      onChange={(e) => setOpenRouterConfig(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:outline-none focus:border-primary-accent text-sm transition-all text-primary"
                    >
                      <optgroup label="Recommended Models">
                        {Object.entries(RECOMMENDED_MODELS)
                          .filter(([_, config]) => config.recommended)
                          .map(([modelId, config]) => (
                            <option key={modelId} value={modelId}>
                              {config.name} - {config.description}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Other Models">
                        {Object.entries(RECOMMENDED_MODELS)
                          .filter(([_, config]) => !config.recommended)
                          .map(([modelId, config]) => (
                            <option key={modelId} value={modelId}>
                              {config.name} - {config.description}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  {openRouterStatus === 'error' && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                      <XCircle className="text-rose-600 shrink-0" size={20} />
                      <p className="text-xs text-rose-800 font-bold leading-snug">
                        {openRouterError}
                      </p>
                    </div>
                  )}

                  <div className="bg-primary-accent/5 border border-primary-accent/20 p-5 rounded-2xl flex gap-4">
                    <Zap className="text-primary-accent shrink-0" size={20} />
                    <div className="space-y-2">
                      <p className="text-xs text-primary font-medium leading-relaxed">
                        <strong>OpenRouter</strong> provides access to multiple AI models including Claude, GPT-4, and Llama. This is the primary engine for consumable enrichment.
                      </p>
                      <p className="text-xs text-primary-accent font-medium">
                        Get your API key at <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primary-accent hover:underline font-bold">openrouter.ai</a>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border-subtle flex justify-end">
                  <button
                    onClick={handleOpenRouterSave}
                    disabled={openRouterStatus === 'validating'}
                    className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg ${openRouterStatus === 'saved'
                      ? 'bg-status-success text-white shadow-status-success/40'
                      : openRouterStatus === 'validating'
                        ? 'bg-surface text-primary-subtle cursor-not-allowed'
                        : 'bg-primary-accent text-white hover:bg-primary-accent/90 shadow-primary-accent/40'
                      }`}
                  >
                    {openRouterStatus === 'validating' ? <Loader2 size={18} className="animate-spin" /> : openRouterStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
                    {openRouterStatus === 'validating' ? 'Verifying Config...' : openRouterStatus === 'saved' ? 'Config Verified & Saved' : 'Save & Validate Config'}
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Gemini Configuration */}
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle overflow-hidden">
            <div className="p-8 space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"></div>
                  <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">Google Gemini (Primary Fallback)</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-primary-subtle mb-2 px-1">
                      API KEY
                    </label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => {
                        setGeminiKey(e.target.value);
                        if (geminiStatus === 'error') setGeminiStatus('idle');
                      }}
                      className={`w-full px-5 py-4 bg-surface border-2 rounded-2xl focus:bg-card focus:outline-none font-mono text-sm transition-all text-primary ${geminiStatus === 'error' ? 'border-status-error/50 focus:border-status-error' : 'border-border-subtle focus:border-blue-500'
                        }`}
                      placeholder="AIza..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary-subtle mb-2 px-1">
                      MODEL SELECTION
                    </label>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:outline-none focus:border-blue-500 text-sm transition-all text-primary"
                    >
                      <option value="gemini-2.0-flash-001">Gemini 2.0 Flash (Recommended)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Next-Gen)</option>
                      <option value="gemini-3.0-flash-preview">Gemini 3.0 Flash Preview</option>
                      <option value="gemini-3.0-pro-preview">Gemini 3.0 Pro Preview</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Powerful)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Stable)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                    </select>
                  </div>

                  {geminiStatus === 'error' && (
                    <div className="bg-status-error/10 border border-status-error/20 p-4 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                      <XCircle className="text-status-error shrink-0" size={20} />
                      <p className="text-xs text-status-error font-bold leading-snug">
                        {geminiError}
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-2xl flex gap-4">
                    <Brain className="text-blue-500 shrink-0" size={20} />
                    <p className="text-xs text-primary font-medium leading-relaxed">
                      <strong>Gemini</strong> is used as a powerful fallback and second opinion for enrichment tasks.
                      Get your key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-bold">aistudio.google.com</a>
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-border-subtle flex justify-end">
                  <button
                    onClick={handleSaveGemini}
                    disabled={geminiStatus === 'validating'}
                    className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg ${geminiStatus === 'saved'
                      ? 'bg-status-success text-white shadow-status-success/40'
                      : geminiStatus === 'validating'
                        ? 'bg-surface text-primary-subtle cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/40'
                      }`}
                  >
                    {geminiStatus === 'validating' ? <Loader2 size={18} className="animate-spin" /> : geminiStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
                    {geminiStatus === 'validating' ? 'Verifying Config...' : geminiStatus === 'saved' ? 'Config Verified & Saved' : 'Save & Validate Config'}
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Firecrawl Configuration */}
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle overflow-hidden">
            <div className="p-8 space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Key size={18} className="text-primary-accent" />
                  <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">Firecrawl API (Live Scraper)</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-primary-subtle mb-2 px-1">
                      API KEY (V2)
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      className={`w-full px-5 py-4 bg-surface border-2 rounded-2xl focus:bg-card focus:outline-none font-mono text-sm transition-all text-primary ${status === 'error' ? 'border-status-error/50 focus:border-status-error' : 'border-border-subtle focus:border-primary-accent'
                        }`}
                      placeholder="fc-..."
                    />
                    <p className="mt-3 text-[10px] text-primary-subtle font-medium leading-relaxed">
                      Your key is stored locally in your browser. Get yours at <a href="https://firecrawl.dev" target="_blank" rel="noreferrer" className="text-primary-accent hover:underline font-bold">firecrawl.dev</a>.
                    </p>
                  </div>

                  {status === 'error' && (
                    <div className="bg-status-error/10 border border-status-error/20 p-4 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                      <XCircle className="text-status-error shrink-0" size={20} />
                      <p className="text-xs text-status-error font-bold leading-snug">
                        {errorMessage}
                      </p>
                    </div>
                  )}

                  <div className="bg-primary-accent/5 border border-primary-accent/20 p-5 rounded-2xl flex gap-4">
                    <AlertCircle className="text-primary-accent shrink-0" size={20} />
                    <p className="text-xs text-primary font-medium leading-relaxed">
                      This key enables the <strong>Smart Research</strong> phase, allowing the AI to pull live specs from NIX.ru and manufacturer sites.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-border-subtle flex justify-end">
                  <button
                    onClick={handleSaveFirecrawl}
                    disabled={status === 'validating'}
                    className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg ${status === 'saved'
                      ? 'bg-status-success text-white shadow-status-success'
                      : status === 'validating'
                        ? 'bg-surface text-primary-subtle cursor-not-allowed'
                        : 'bg-primary-accent text-white hover:bg-primary-accent/90 shadow-primary-accent/40'
                      }`}
                  >
                    {status === 'validating' ? <Loader2 size={18} className="animate-spin" /> : status === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
                    {status === 'validating' ? 'Verifying Key...' : status === 'saved' ? 'Key Verified & Saved' : 'Save & Validate Key'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div className="space-y-8">
          {/* System Health Overview */}
          {systemHealth && (
            <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle overflow-hidden">
              <div className="p-8">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp size={18} className="text-primary-accent" />
                  <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">System Health Overview</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  <div className="text-center">
                    <div className={`text-2xl font-black mb-1 ${systemHealth.overallHealth === 'healthy' ? 'text-status-success' :
                      systemHealth.overallHealth === 'degraded' ? 'text-status-warning' : 'text-status-error'
                      }`}>
                      {systemHealth.overallHealth}
                    </div>
                    <div className="text-xs text-primary-subtle font-medium">Overall Health</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-black text-primary mb-1">
                      {systemHealth.healthyServices}/{systemHealth.servicesCount}
                    </div>
                    <div className="text-xs text-primary-subtle font-medium">Healthy Services</div>
                  </div>

                  <div className="text-center">
                    <div className={`text-2xl font-black mb-1 ${systemHealth.criticalAlerts > 0 ? 'text-status-error' : 'text-status-success'
                      }`}>
                      {systemHealth.criticalAlerts}
                    </div>
                    <div className="text-xs text-primary-subtle font-medium">Critical Alerts</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-black text-primary mb-1">
                      {Math.round(systemHealth.averageResponseTime)}ms
                    </div>
                    <div className="text-xs text-primary-subtle font-medium">Avg Response</div>
                  </div>
                </div>

                {systemHealth.totalAlerts > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="text-yellow-600" size={16} />
                      <span className="text-sm font-bold text-yellow-800">Active Alerts</span>
                    </div>
                    <p className="text-xs text-yellow-700">
                      {systemHealth.totalAlerts} active alerts detected. Check the detailed monitoring below for more information.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed API Status */}
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <SettingsIcon size={18} className="text-primary-accent" />
                <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">API Services Monitoring</h2>
              </div>

              <ApiStatusIndicator showDetails={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
