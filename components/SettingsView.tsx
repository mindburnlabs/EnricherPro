
import React, { useState, useEffect } from 'react';
import { Shield, Key, Save, AlertCircle, CheckCircle2, Loader2, XCircle, Activity, TrendingUp, Settings as SettingsIcon, Zap, Brain, Moon, Sun, Monitor, Laptop, Globe, Search, RefreshCw, Server } from 'lucide-react';
import { validateFirecrawlApiKey } from '../services/firecrawlService';
import ApiStatusIndicator from './ApiStatusIndicator';
import { apiHealthMonitoringService } from '../services/apiHealthMonitoringService';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

const FIRECRAWL_STORAGE_KEY = 'firecrawl_api_key';

interface SettingsViewProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onClearData: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ theme, onThemeChange, onClearData }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'firecrawl' | 'monitoring'>('general');
  const [systemHealth, setSystemHealth] = useState<any>(null);

  // --- Start: Configuration States ---

  // Firecrawl
  const [firecrawlKey, setFirecrawlKey] = useState('');
  const [firecrawlStatus, setFirecrawlStatus] = useState<'idle' | 'validating' | 'saved' | 'error'>('idle');
  const [firecrawlError, setFirecrawlError] = useState('');

  // --- End: Configuration States ---

  useEffect(() => {
    loadSettings();

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
  };

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


  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary mb-2 flex items-center gap-3">
          <SettingsIcon className="text-primary-accent" size={32} /> System Settings
        </h1>
        <p className="text-primary-subtle font-medium">Configure API keys and system preferences.</p>
      </div>

      {/* Modern Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 bg-surface p-1.5 rounded-2xl border border-border-subtle w-fit">
        {[
          { id: 'general', label: 'General', icon: Monitor },
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
          <Card className="animate-in fade-in slide-in-from-bottom-4">
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
                      } hover:scale-[1.02] active:scale-95 duration-200`}
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
                  disabled
                  className="p-3 rounded-xl border text-left transition-all duration-200 bg-primary-accent/10 border-primary-accent text-primary-accent shadow-md shadow-primary-accent/10 cursor-default"
                >
                  <div className="font-medium mb-1">Firecrawl Agent</div>
                  <div className="text-xs opacity-70">Advanced Autonomous Web Research</div>
                </button>
              </div>
              <p className="mt-2 text-xs text-primary-subtle">
                * Enricher Pro now runs exclusively on Firecrawl for maximum reliability.
              </p>
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
                <Button
                  onClick={onClearData}
                  variant="danger"
                  leftIcon={<AlertCircle size={18} />}
                >
                  Delete All History
                </Button>
              </div>
            </section>
          </Card>
        )}

        {/* === FIRECRAWL TAB === */}
        {activeTab === 'firecrawl' && (
          <Card className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-xl font-bold text-primary mb-2">Firecrawl Scraper</h2>
              <p className="text-sm text-primary-subtle">Advanced web scraping & agentic crawling.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  type="password"
                  label="API KEY (V2)"
                  value={firecrawlKey}
                  onChange={(e) => setFirecrawlKey(e.target.value)}
                  placeholder="fc-..."
                />
                <div className="mt-2 text-xs text-primary-subtle flex items-center gap-1 ml-1">
                  <CheckCircle2 size={12} className="text-status-success" /> Using API V2 (Latest)
                </div>
              </div>

              {firecrawlStatus === 'error' && (
                <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-xl text-xs font-bold text-status-error flex items-center gap-2">
                  <XCircle size={16} /> {firecrawlError}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveFirecrawl}
                  isLoading={firecrawlStatus === 'validating'}
                  loadingText="Verifying..."
                  className="bg-status-warning hover:bg-status-warning/90 shadow-orange-500/40"
                  variant="primary" // Custom styling overrides this but used for base props
                  leftIcon={firecrawlStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
                >
                  {firecrawlStatus === 'saved' ? 'Verified & Saved' : 'Save Firecrawl Key'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* === MONITORING TAB === */}
        {activeTab === 'monitoring' && (
          <Card className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
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
          </Card>
        )}

      </div>
    </div >
  );
};

export default SettingsView;
