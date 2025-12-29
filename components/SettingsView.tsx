
import React, { useState, useEffect } from 'react';
import { Shield, Key, Save, AlertCircle, CheckCircle2, Loader2, XCircle, Activity, TrendingUp, Settings as SettingsIcon, Zap, Brain, Moon, Sun, Monitor, Laptop, Globe, Search, RefreshCw, Server } from 'lucide-react';
import { validateFirecrawlApiKey } from '../services/firecrawlService';
import ApiStatusIndicator from './ApiStatusIndicator';
import { apiHealthMonitoringService } from '../services/apiHealthMonitoringService';
import { createOpenRouterService, RECOMMENDED_MODELS, OpenRouterConfig } from '../services/openRouterService';
import { PerplexityService, DEFAULT_PERPLEXITY_CONFIG, PerplexityConfig, PERPLEXITY_MODELS } from '../services/perplexityService';

const FIRECRAWL_STORAGE_KEY = 'firecrawl_api_key';
const OPENROUTER_STORAGE_KEY = 'openrouter_config';
const GEMINI_STORAGE_KEY = 'gemini_api_key';
const GEMINI_MODEL_STORAGE_KEY = 'gemini_model';
const PRIMARY_ENGINE_KEY = 'primary_engine_preference';

interface SettingsViewProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onClearData: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ theme, onThemeChange, onClearData }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'openrouter' | 'perplexity' | 'gemini' | 'firecrawl' | 'monitoring'>('general');
  const [systemHealth, setSystemHealth] = useState<any>(null);

  // --- Start: Configuration States ---

  // Firecrawl
  const [firecrawlKey, setFirecrawlKey] = useState('');
  const [firecrawlStatus, setFirecrawlStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [firecrawlError, setFirecrawlError] = useState('');

  // Gemini
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-pro');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [geminiError, setGeminiError] = useState('');

  // OpenRouter
  const [openRouterConfig, setOpenRouterConfig] = useState<OpenRouterConfig>({
    apiKey: '',
    model: 'xiaomi/mimo-v2-flash:free'
  });
  const [openRouterStatus, setOpenRouterStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [openRouterError, setOpenRouterError] = useState('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Perplexity
  const [perplexityConfig, setPerplexityConfig] = useState<PerplexityConfig>(DEFAULT_PERPLEXITY_CONFIG);
  const [perplexityStatus, setPerplexityStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [perplexityError, setPerplexityError] = useState('');

  // Engine
  const [engine, setEngine] = useState<'gemini' | 'openrouter' | 'firecrawl'>('gemini');

  // --- End: Configuration States ---

  useEffect(() => {
    loadSettings();

    // Load available OpenRouter models if key exists
    const savedOrKey = localStorage.getItem(OPENROUTER_STORAGE_KEY);
    if (savedOrKey) {
      try {
        const config = JSON.parse(savedOrKey);
        if (config.apiKey) {
          // Initial fetch could go here if we wanted to auto-load models
        }
      } catch (e) { }
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

  const loadSettings = () => {
    // Firecrawl
    const savedFirecrawl = localStorage.getItem(FIRECRAWL_STORAGE_KEY);
    if (savedFirecrawl) setFirecrawlKey(savedFirecrawl);

    // Gemini
    const savedGemini = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (savedGemini) setGeminiKey(savedGemini);
    const savedGeminiModel = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
    if (savedGeminiModel) setGeminiModel(savedGeminiModel);

    // OpenRouter
    const savedOpenRouter = localStorage.getItem(OPENROUTER_STORAGE_KEY);
    if (savedOpenRouter) {
      try {
        setOpenRouterConfig(JSON.parse(savedOpenRouter));
      } catch (e) { console.warn('Failed to parse OpenRouter config', e); }
    }

    // Perplexity
    const perplexityService = PerplexityService.getInstance();
    setPerplexityConfig(perplexityService.getConfig());

    // Engine
    const savedEngine = localStorage.getItem(PRIMARY_ENGINE_KEY) as any;
    if (savedEngine && ['gemini', 'openrouter', 'firecrawl'].includes(savedEngine)) {
      setEngine(savedEngine);
    }
  };

  // Save engine preference when it changes
  useEffect(() => {
    localStorage.setItem(PRIMARY_ENGINE_KEY, engine);
    // Dispatch event so other components (like App.tsx) can react immediately if they listen
    window.dispatchEvent(new Event('engine-preference-changed'));
  }, [engine]);

  // --- Handlers ---

  const handleSaveFirecrawl = async () => {
    if (!firecrawlKey.trim()) {
      setFirecrawlError("API Key cannot be empty");
      setFirecrawlStatus('error');
      return;
    }

    setFirecrawlStatus('validating');
    setFirecrawlError('');

    const isValid = await validateFirecrawlApiKey(firecrawlKey);

    if (isValid) {
      localStorage.setItem(FIRECRAWL_STORAGE_KEY, firecrawlKey);
      window.dispatchEvent(new Event('storage'));
      setFirecrawlStatus('saved');
      setTimeout(() => setFirecrawlStatus('idle'), 3000);
    } else {
      setFirecrawlError("Invalid API Key. Please check your credentials at firecrawl.dev");
      setFirecrawlStatus('error');
    }
  };

  const handleSaveGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiError("API Key cannot be empty");
      setGeminiStatus('error');
      return;
    }
    // Simple format check
    if (!geminiKey.startsWith('AIza')) {
      // Just a warning, don't block
      console.warn("API Key doesn't start with AIza, might be invalid but proceeding.");
    }

    setGeminiStatus('saved');
    localStorage.setItem(GEMINI_STORAGE_KEY, geminiKey);
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, geminiModel);
    setTimeout(() => setGeminiStatus('idle'), 3000);
  };

  const handleOpenRouterSave = async () => {
    if (!openRouterConfig.apiKey.trim()) {
      setOpenRouterError("API Key cannot be empty");
      setOpenRouterStatus('error');
      return;
    }

    setOpenRouterStatus('validating');
    setOpenRouterError('');

    try {
      const service = createOpenRouterService(openRouterConfig);
      // Validate by fetching models if haven't already
      if (availableModels.length === 0) {
        await service.getAvailableModels();
      }

      localStorage.setItem(OPENROUTER_STORAGE_KEY, JSON.stringify(openRouterConfig));
      window.dispatchEvent(new Event('storage'));
      setOpenRouterStatus('saved');
      setTimeout(() => setOpenRouterStatus('idle'), 3000);
    } catch (error) {
      setOpenRouterError(`Invalid configuration: ${error}`);
      setOpenRouterStatus('error');
    }
  };

  const fetchOpenRouterModels = async () => {
    if (!openRouterConfig.apiKey) {
      setOpenRouterError("Enter API Key first.");
      return;
    }
    setIsFetchingModels(true);
    setOpenRouterError('');
    try {
      const service = createOpenRouterService(openRouterConfig);
      const models = await service.getAvailableModels();
      setAvailableModels(models);
    } catch (e) {
      setOpenRouterError(`Failed to fetch models: ${e}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSavePerplexity = async () => {
    if (perplexityConfig.provider === 'direct' && !perplexityConfig.apiKey) {
      setPerplexityError("Direct API requires an API Key.");
      setPerplexityStatus('error');
      return;
    }

    setPerplexityStatus('validating');
    setPerplexityError('');

    // Save via service
    const service = PerplexityService.getInstance();
    service.updateConfig(perplexityConfig);

    setPerplexityStatus('saved');
    setTimeout(() => setPerplexityStatus('idle'), 3000);
  };

  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary mb-2 flex items-center gap-3">
          <SettingsIcon className="text-primary-accent" size={32} /> System Settings
        </h1>
        <p className="text-primary-subtle font-medium">Configure AI providers, API keys, and system preferences.</p>
      </div>

      {/* Modern Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 bg-surface p-1.5 rounded-2xl border border-border-subtle w-fit">
        {[
          { id: 'general', label: 'General', icon: Monitor },
          { id: 'openrouter', label: 'OpenRouter', icon: Brain },
          { id: 'perplexity', label: 'Perplexity', icon: Search },
          { id: 'gemini', label: 'Gemini', icon: Zap },
          { id: 'firecrawl', label: 'Firecrawl', icon: Globe },
          { id: 'monitoring', label: 'Monitoring', icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
              ? 'bg-card text-primary shadow-sm ring-1 ring-border-subtle'
              : 'text-primary-subtle hover:text-primary hover:bg-card/50'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">

        {/* === GENERAL TAB === */}
        {activeTab === 'general' && (
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle p-8 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <div className="flex items-center gap-2 mb-6 text-primary-subtle">
                <Monitor size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">Appearance</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'light', label: 'Light Mode', desc: 'Clean & crisp', icon: Sun, color: 'text-amber-500', bg: 'bg-white' },
                  { id: 'dark', label: 'Dark Mode', desc: 'Easy on eyes', icon: Moon, color: 'text-indigo-400', bg: 'bg-slate-900' },
                  { id: 'system', label: 'System', desc: 'Auto-detect', icon: Laptop, color: 'text-slate-500', bg: 'bg-gradient-to-br from-white to-slate-900' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onThemeChange(t.id as any)}
                    className={`p-4 rounded-2xl border-2 transition-all text-left group ${theme === t.id ? 'border-primary-accent bg-primary-accent/5' : 'border-border-subtle hover:border-primary-accent/50'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-full ${t.bg} shadow-md flex items-center justify-center mb-3 ${t.color}`}>
                      <t.icon size={20} />
                    </div>
                    <div className="font-bold text-primary">{t.label}</div>
                    <div className="text-xs text-primary-subtle">{t.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-8 pt-8 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-6 text-primary-subtle">
                <Brain size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">Primary Engine</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setEngine('gemini')}
                  className={`p-3 rounded-xl border text-left transition-colors ${engine === 'gemini'
                    ? 'bg-primary-accent/10 border-primary-accent text-primary-accent shadow-md shadow-primary-accent/10'
                    : 'bg-surface border-border-subtle hover:border-primary-accent/50 text-primary-subtle hover:bg-card'
                    }`}
                >
                  <div className="font-medium mb-1">Gemini 2.0 (Default)</div>
                  <div className="text-xs opacity-70">Best overall reasoning & synthesis</div>
                </button>

                <button
                  onClick={() => setEngine('openrouter')}
                  className={`p-3 rounded-xl border text-left transition-colors ${engine === 'openrouter'
                    ? 'bg-primary-accent/10 border-primary-accent text-primary-accent shadow-md shadow-primary-accent/10'
                    : 'bg-surface border-border-subtle hover:border-primary-accent/50 text-primary-subtle hover:bg-card'
                    }`}
                >
                  <div className="font-medium mb-1">OpenRouter</div>
                  <div className="text-xs opacity-70">Access to GPT-4o, Claude 3.5, etc.</div>
                </button>

                <button
                  onClick={() => setEngine('firecrawl')}
                  className={`p-3 rounded-xl border text-left transition-colors ${engine === 'firecrawl'
                    ? 'bg-primary-accent/10 border-primary-accent text-primary-accent shadow-md shadow-primary-accent/10'
                    : 'bg-surface border-border-subtle hover:border-primary-accent/50 text-primary-subtle hover:bg-card'
                    }`}
                >
                  <div className="font-medium mb-1">Firecrawl Agent</div>
                  <div className="text-xs opacity-70">Advanced Autonomous Web Research</div>
                </button>
              </div>
            </section>

            <section className="mt-8 pt-8 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-6 text-status-error">
                <AlertCircle size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">Danger Zone</h2>
              </div>
              <div className="bg-status-error/5 border border-status-error/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-primary mb-1">Clear Application History</h3>
                  <p className="text-sm text-primary-subtle">Permanently remove all enriched items, queues, and cached data. This action cannot be undone.</p>
                </div>
                <button
                  onClick={onClearData}
                  className="px-6 py-3 bg-white border-2 border-status-error text-status-error rounded-xl font-bold hover:bg-status-error hover:text-white transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                >
                  <AlertCircle size={18} />
                  Delete All History
                </button>
              </div>
            </section>
          </div>
        )}

        {/* === OPENROUTER TAB === */}
        {activeTab === 'openrouter' && (
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-primary mb-2">OpenRouter Configuration</h2>
                <p className="text-sm text-primary-subtle">Primary engine for complex synthesis and model routing.</p>
              </div>
              <div className="bg-primary-accent/10 px-3 py-1 rounded-full">
                <span className="text-xs font-bold text-primary-accent">RECOMMENDED</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-subtle mb-2 ml-1">API KEY</label>
                <input
                  type="password"
                  value={openRouterConfig.apiKey}
                  onChange={(e) => setOpenRouterConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-primary-accent focus:outline-none font-mono text-sm transition-all"
                  placeholder="sk-or-v1-..."
                />
              </div>

              <div>
                <div className="flex justify-between items-end mb-2 ml-1">
                  <label className="block text-xs font-bold text-primary-subtle">MODEL SELECTION</label>
                  <button
                    onClick={fetchOpenRouterModels}
                    disabled={isFetchingModels || !openRouterConfig.apiKey}
                    className="text-xs font-bold text-primary-accent hover:text-primary-accent-hover flex items-center gap-1 disabled:opacity-50"
                  >
                    {isFetchingModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {isFetchingModels ? 'Fetching...' : 'Refresh Models'}
                  </button>
                </div>
                <select
                  value={openRouterConfig.model}
                  onChange={(e) => setOpenRouterConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-primary-accent focus:outline-none text-sm"
                >
                  <optgroup label="Core Recommended">
                    {Object.entries(RECOMMENDED_MODELS).filter(([_, v]) => v.recommended).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </optgroup>
                  {availableModels.length > 0 && (
                    <optgroup label="All Available Models">
                      {availableModels.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name || m.id}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Other">
                    {Object.entries(RECOMMENDED_MODELS).filter(([_, v]) => !v.recommended).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {openRouterStatus === 'error' && (
                <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-xl text-xs font-bold text-status-error flex items-center gap-2">
                  <XCircle size={16} /> {openRouterError}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleOpenRouterSave}
                  disabled={openRouterStatus === 'validating'}
                  className="btn-primary"
                >
                  {openRouterStatus === 'validating' ? 'Validating...' : openRouterStatus === 'saved' ? 'Saved' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === PERPLEXITY TAB === */}
        {activeTab === 'perplexity' && (
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-primary mb-2">Perplexity Search Engine</h2>
                <p className="text-sm text-primary-subtle">Configure the "Search" phase engine. Choose between OpenRouter or Direct API.</p>
              </div>
              <Search size={24} className="text-primary-subtle" />
            </div>

            <div className="bg-surface p-1 rounded-xl flex w-fit border border-border-subtle">
              <button
                onClick={() => setPerplexityConfig(prev => ({ ...prev, provider: 'openrouter' }))}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${perplexityConfig.provider === 'openrouter' ? 'bg-card text-primary shadow-sm' : 'text-primary-subtle'}`}
              >
                Use OpenRouter
              </button>
              <button
                onClick={() => setPerplexityConfig(prev => ({ ...prev, provider: 'direct' }))}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${perplexityConfig.provider === 'direct' ? 'bg-card text-primary shadow-sm' : 'text-primary-subtle'}`}
              >
                Use Direct API
              </button>
            </div>

            <div className="space-y-4">
              {perplexityConfig.provider === 'direct' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-primary-subtle mb-2 ml-1">PERPLEXITY API KEY</label>
                  <input
                    type="password"
                    value={perplexityConfig.apiKey}
                    onChange={(e) => setPerplexityConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-primary-accent focus:outline-none font-mono text-sm"
                    placeholder="pplx-..."
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-primary-subtle mb-2 ml-1">MODEL</label>
                <select
                  value={perplexityConfig.model}
                  onChange={(e) => setPerplexityConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-primary-accent focus:outline-none text-sm"
                >
                  {Object.entries(PERPLEXITY_MODELS).map(([k, v]) => (
                    <option key={v} value={perplexityConfig.provider === 'openrouter' ? `perplexity/${v}` : v}>
                      {k.replace(/-/g, ' ').toUpperCase()} ({perplexityConfig.provider === 'openrouter' ? 'Via OpenRouter' : 'Direct'})
                    </option>
                  ))}
                </select>
              </div>

              {perplexityStatus === 'error' && (
                <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-xl text-xs font-bold text-status-error flex items-center gap-2">
                  <XCircle size={16} /> {perplexityError}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSavePerplexity}
                  className="btn-primary"
                >
                  {perplexityStatus === 'saved' ? 'Saved' : 'Save Perplexity Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === GEMINI TAB === */}
        {activeTab === 'gemini' && (
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-xl font-bold text-primary mb-2">Google Gemini</h2>
              <p className="text-sm text-primary-subtle">Primary data synthesis and reasoning engine.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-subtle mb-2 ml-1">API KEY</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-primary-accent focus:outline-none font-mono text-sm"
                  placeholder="AIza..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-subtle mb-2 ml-1">MODEL</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-primary-accent focus:outline-none text-sm"
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Latest)</option>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (Powerful)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Stable)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Reasoning)</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy Stable)</option>
                </select>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => {
                    handleSaveGemini();
                    window.dispatchEvent(new Event('settings-updated'));
                  }}
                  className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg bg-primary-accent text-white hover:bg-primary-accent-hover shadow-blue-500/40"
                >
                  {geminiStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
                  {geminiStatus === 'saved' ? 'Settings Saved' : 'Save Gemini Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === FIRECRAWL TAB === */}
        {activeTab === 'firecrawl' && (
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-xl font-bold text-primary mb-2">Firecrawl Scraper</h2>
              <p className="text-sm text-primary-subtle">Advanced web scraping & agentic crawling.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-subtle mb-2 ml-1">API KEY (V2)</label>
                <input
                  type="password"
                  value={firecrawlKey}
                  onChange={(e) => setFirecrawlKey(e.target.value)}
                  className="w-full px-5 py-4 bg-surface border-2 border-border-subtle rounded-2xl focus:bg-card focus:border-status-warning focus:outline-none font-mono text-sm"
                  placeholder="fc-..."
                />
                <div className="mt-2 text-xs text-primary-subtle flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-status-success" /> Using API V2 (Latest)
                </div>
              </div>

              {firecrawlStatus === 'error' && (
                <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-xl text-xs font-bold text-status-error flex items-center gap-2">
                  <XCircle size={16} /> {firecrawlError}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveFirecrawl}
                  disabled={firecrawlStatus === 'validating'}
                  className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg bg-status-warning text-white hover:bg-status-warning/90 shadow-orange-500/40"
                >
                  {firecrawlStatus === 'validating' ? <Loader2 size={18} className="animate-spin" /> : firecrawlStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
                  {firecrawlStatus === 'validating' ? 'Verifying...' : firecrawlStatus === 'saved' ? 'Verified & Saved' : 'Save Firecrawl Key'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === MONITORING TAB === */}
        {activeTab === 'monitoring' && (
          <div className="bg-card rounded-[32px] shadow-xl shadow-shadow-color/5 border border-border-subtle p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 mb-6">
              <Activity size={18} className="text-primary-accent" />
              <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">Live API Status</h2>
            </div>

            {systemHealth && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className={`text-2xl font-black ${systemHealth.overallHealth === 'healthy' ? 'text-status-success' : 'text-status-error'}`}>
                    {systemHealth.overallHealth.toUpperCase()}
                  </div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">SYSTEM HEALTH</div>
                </div>
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className="text-2xl font-black text-primary">{Math.round(systemHealth.averageResponseTime)}ms</div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">AVG LATENCY</div>
                </div>
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className="text-2xl font-black text-primary">{systemHealth.totalRequests}</div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">TOTAL REQUESTS</div>
                </div>
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className="text-2xl font-black text-primary">{systemHealth.uptime}%</div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">EST. UPTIME</div>
                </div>
              </div>
            )}

            <ApiStatusIndicator showDetails={true} />
          </div>
        )}

      </div>
    </div >
  );
};

export default SettingsView;
