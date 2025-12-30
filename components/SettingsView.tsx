
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
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
      setFirecrawlError(t('settings.firecrawl.empty_key'));
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
      setFirecrawlError(t('settings.firecrawl.invalid_key'));
      setFirecrawlStatus('error');
    }
  };


  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-primary mb-2 flex items-center gap-3">
          <SettingsIcon className="text-primary-accent" size={32} /> {t('settings.title')}
        </h1>
        <p className="text-primary-subtle font-medium">{t('settings.subtitle')}</p>
      </div>

      {/* Modern Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 bg-surface p-1.5 rounded-2xl border border-border-subtle w-fit">
        {[
          { id: 'general', label: t('settings.tabs.general'), icon: Monitor },
          { id: 'firecrawl', label: t('settings.tabs.firecrawl'), icon: Globe },
          { id: 'monitoring', label: t('settings.tabs.monitoring'), icon: Activity },
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
                <h2 className="text-xs font-black uppercase tracking-widest">{t('settings.appearance.title')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'light', label: t('settings.appearance.light'), desc: t('settings.appearance.light_desc'), icon: Sun, color: 'text-amber-500', bg: 'bg-white' },
                  { id: 'dark', label: t('settings.appearance.dark'), desc: t('settings.appearance.dark_desc'), icon: Moon, color: 'text-indigo-400', bg: 'bg-slate-900' },
                  { id: 'system', label: t('settings.appearance.system'), desc: t('settings.appearance.system_desc'), icon: Laptop, color: 'text-slate-500', bg: 'bg-gradient-to-br from-white to-slate-900' },
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
                <Globe size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">{t('settings.language.title')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  disabled
                  className="p-4 rounded-2xl border-2 transition-all text-left border-border-subtle opacity-50 cursor-not-allowed bg-surface/50"
                  title="Coming Soon"
                >
                  <div className="font-bold text-primary">English</div>
                  <div className="text-xs text-primary-subtle">US English (Coming Soon)</div>
                </button>
                <button
                  onClick={() => { i18n.changeLanguage('ru'); localStorage.setItem('i18nextLng', 'ru'); }}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${i18n.language === 'ru' || i18n.language.startsWith('ru') ? 'border-primary-accent bg-primary-accent/5' : 'border-border-subtle hover:border-primary-accent/50'}`}
                >
                  <div className="font-bold text-primary">Русский</div>
                  <div className="text-xs text-primary-subtle">Russian</div>
                </button>
              </div>
            </section>

            <section className="mt-8 pt-8 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-6 text-primary-subtle">
                <Brain size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">{t('settings.engine.title')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  disabled
                  className="p-3 rounded-xl border text-left transition-all duration-200 bg-primary-accent/10 border-primary-accent text-primary-accent shadow-md shadow-primary-accent/10 cursor-default"
                >
                  <div className="font-medium mb-1">Firecrawl Agent</div>
                  <div className="text-xs opacity-70">{t('settings.engine.firecrawl_desc')}</div>
                </button>
              </div>
              <p className="mt-2 text-xs text-primary-subtle">
                {t('settings.engine.exclusive_note')}
              </p>
            </section>

            <section className="mt-8 pt-8 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-6 text-status-error">
                <AlertCircle size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">{t('settings.danger_zone.title')}</h2>
              </div>
              <div className="bg-status-error/5 border border-status-error/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-primary mb-1">{t('settings.danger_zone.clear_history')}</h3>
                  <p className="text-sm text-primary-subtle">{t('settings.danger_zone.clear_desc')}</p>
                </div>
                <Button
                  onClick={onClearData}
                  variant="danger"
                  leftIcon={<AlertCircle size={18} />}
                >
                  {t('settings.danger_zone.delete_btn')}
                </Button>
              </div>
            </section>
          </Card>
        )}

        {/* === FIRECRAWL TAB === */}
        {activeTab === 'firecrawl' && (
          <Card className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-xl font-bold text-primary mb-2">{t('settings.firecrawl.title')}</h2>
              <p className="text-sm text-primary-subtle">{t('settings.firecrawl.subtitle')}</p>
            </div>

            <div className="space-y-6">
              {/* API Key Section */}
              <div className="p-6 bg-surface rounded-2xl border border-border-subtle">
                <Input
                  type="password"
                  label={t('settings.firecrawl.api_key_label')}
                  value={firecrawlKey}
                  onChange={(e) => setFirecrawlKey(e.target.value)}
                  placeholder="fc-..."
                />
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-xs text-primary-subtle flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-status-success" /> {t('settings.firecrawl.using_v2')}
                  </div>
                  <Button
                    onClick={handleSaveFirecrawl}
                    isLoading={firecrawlStatus === 'validating'}
                    loadingText={t('settings.firecrawl.validating_btn')}
                    className="bg-primary text-white hover:bg-primary/90"
                    size="sm"
                    variant="primary"
                    leftIcon={firecrawlStatus === 'saved' ? <CheckCircle2 size={14} /> : <Save size={14} />}
                  >
                    {firecrawlStatus === 'saved' ? t('settings.firecrawl.verified_btn') : t('settings.firecrawl.save_btn')}
                  </Button>
                </div>
                {firecrawlStatus === 'error' && (
                  <div className="mt-3 p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-xs font-bold text-status-error flex items-center gap-2">
                    <XCircle size={14} /> {firecrawlError}
                  </div>
                )}
              </div>

              {/* Research Protocol Configuration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <SettingsIcon className="text-primary-accent" size={18} />
                  <h3 className="text-sm font-black text-primary uppercase tracking-widest">{t('settings.firecrawl.research_protocol')}</h3>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'fast', label: t('settings.firecrawl.modes.fast'), desc: t('settings.firecrawl.modes.fast_desc'), icon: Zap, color: 'text-amber-500' },
                    { id: 'standard', label: t('settings.firecrawl.modes.standard'), desc: t('settings.firecrawl.modes.standard_desc'), icon: Search, color: 'text-indigo-500' },
                    { id: 'exhaustive', label: t('settings.firecrawl.modes.exhaustive'), desc: t('settings.firecrawl.modes.exhaustive_desc'), icon: Brain, color: 'text-purple-500' }
                  ].map((m) => {
                    const currentMode = localStorage.getItem('firesearch_mode') || 'standard';
                    const isActive = currentMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          localStorage.setItem('firesearch_mode', m.id);
                          window.dispatchEvent(new Event('storage')); // Trigger update
                          // Force re-render locally for instant feedback
                          setActiveTab('firecrawl');
                        }}
                        className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden group ${isActive
                          ? 'bg-primary-accent/5 border-primary-accent shadow-lg shadow-primary-accent/10'
                          : 'bg-surface border-border-subtle hover:border-primary-accent/50'
                          }`}
                      >
                        <div className={`p-2 rounded-lg w-fit mb-3 ${isActive ? 'bg-primary-accent text-white' : 'bg-background ' + m.color}`}>
                          <m.icon size={18} />
                        </div>
                        <div className="font-bold text-primary text-sm mb-1">{m.label}</div>
                        <div className="text-xs text-primary-subtle font-medium">{m.desc}</div>
                        {isActive && <div className="absolute top-2 right-2 text-primary-accent"><CheckCircle2 size={14} /></div>}
                      </button>
                    );
                  })}
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Strict Sources */}
                  {(() => {
                    const isStrict = localStorage.getItem('firesearch_strict') === 'true';
                    return (
                      <button
                        onClick={() => {
                          localStorage.setItem('firesearch_strict', String(!isStrict));
                          setActiveTab('firecrawl');
                        }}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isStrict
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-surface border-border-subtle hover:border-border-highlight'
                          }`}
                      >
                        <div className={`p-2 rounded-full ${isStrict ? 'bg-emerald-500 text-white' : 'bg-border-subtle text-primary-subtle'}`}>
                          <Shield size={16} />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-primary">{t('settings.firecrawl.toggles.strict_title')}</div>
                          <div className="text-[10px] text-primary-subtle">{t('settings.firecrawl.toggles.strict_desc')}</div>
                        </div>
                        <div className={`ml-auto w-10 h-6 rounded-full p-1 transition-colors ${isStrict ? 'bg-emerald-500' : 'bg-border-subtle'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isStrict ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </button>
                    );
                  })()}

                  {/* Image Audit */}
                  {(() => {
                    const isImages = localStorage.getItem('firesearch_images') !== 'false'; // Default true
                    return (
                      <button
                        onClick={() => {
                          localStorage.setItem('firesearch_images', String(!isImages));
                          setActiveTab('firecrawl');
                        }}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isImages
                          ? 'bg-indigo-500/5 border-indigo-500/30'
                          : 'bg-surface border-border-subtle hover:border-border-highlight'
                          }`}
                      >
                        <div className={`p-2 rounded-full ${isImages ? 'bg-indigo-500 text-white' : 'bg-border-subtle text-primary-subtle'}`}>
                          <SettingsIcon size={16} />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-primary">{t('settings.firecrawl.toggles.images_title')}</div>
                          <div className="text-[10px] text-primary-subtle">{t('settings.firecrawl.toggles.images_desc')}</div>
                        </div>
                        <div className={`ml-auto w-10 h-6 rounded-full p-1 transition-colors ${isImages ? 'bg-indigo-500' : 'bg-border-subtle'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isImages ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </button>
                    );
                  })()}
                </div>
              </div>

            </div>
          </Card>
        )}

        {/* === MONITORING TAB === */}
        {activeTab === 'monitoring' && (
          <Card className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 mb-6">
              <Activity size={18} className="text-primary-accent" />
              <h2 className="text-xs font-black text-primary-subtle uppercase tracking-[0.2em]">{t('settings.monitoring.title')}</h2>
            </div>

            {systemHealth && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className={`text-2xl font-black ${systemHealth.overallHealth === 'healthy' ? 'text-status-success' : 'text-status-error'}`}>
                    {systemHealth.overallHealth.toUpperCase()}
                  </div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">{t('settings.monitoring.health')}</div>
                </div>
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className="text-2xl font-black text-primary">{Math.round(systemHealth.averageResponseTime)}ms</div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">{t('settings.monitoring.latency')}</div>
                </div>
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className="text-2xl font-black text-primary">{systemHealth.totalRequests}</div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">{t('settings.monitoring.total_inc')}</div>
                </div>
                <div className="bg-surface p-4 rounded-2xl text-center border border-border-subtle">
                  <div className="text-2xl font-black text-primary">{systemHealth.uptime}%</div>
                  <div className="text-xs font-bold text-primary-subtle mt-1">{t('settings.monitoring.uptime')}</div>
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
