
import React, { useState, useEffect } from 'react';
import { FileInput, List, Database, Settings, ShieldCheck, Award } from 'lucide-react';
import { getFirecrawlApiKey } from '../services/firecrawlService';
import ApiStatusIndicator from './ApiStatusIndicator';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NavItem = ({ icon: Icon, label, id, active, onClick, mobile = false }: any) => (
  <button
    onClick={() => onClick(id)}
    className={
      mobile
        ? `flex-1 flex flex-col items-center justify-center py-2 px-1 transition-all ${active ? 'text-primary-accent scale-110' : 'text-primary-subtle'
        }`
        : `w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all rounded-xl mb-1 ${active
          ? 'bg-primary-accent/10 text-primary-accent border border-primary-accent/20 shadow-lg shadow-primary-accent/20'
          : 'text-primary-subtle hover:bg-primary-accent/5 hover:text-primary'
        }`
    }
  >
    <Icon size={mobile ? 22 : 18} />
    <span className={mobile ? 'text-[10px] mt-1' : ''}>{label}</span>
  </button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [activeEngineFormatted, setActiveEngineFormatted] = useState('Gemini 2.0 (Default)');

  const checkKeys = () => {
    // Determine active engine
    const engine = localStorage.getItem('primary_engine_preference') || 'gemini';
    const geminiModel = localStorage.getItem('gemini_model') || 'gemini-1.5-pro';
    const geminiDisplay = geminiModel.replace('google/', '').replace('gemini-', 'Gemini ').replace('-preview', '');

    let display = 'Gemini 2.0 (Default)';
    if (engine === 'firecrawl') display = 'Firecrawl Agent';
    else if (engine === 'openrouter') display = 'OpenRouter AI';
    else display = geminiDisplay;

    setActiveEngineFormatted(display);
  };

  useEffect(() => {
    checkKeys();
    window.addEventListener('storage', checkKeys);
    // Custom event for immediate updates within the same window
    window.addEventListener('settings-updated', checkKeys);
    return () => {
      window.removeEventListener('storage', checkKeys);
      window.removeEventListener('settings-updated', checkKeys);
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background h-[100dvh] transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 glass-sidebar flex-shrink-0 flex-col h-full p-6">
        <div className="flex items-center gap-3 text-primary font-bold text-xl mb-10 px-2">
          <div className="p-2 bg-primary-accent rounded-xl shadow-xl shadow-primary-accent/20 text-white">
            <Database size={24} />
          </div>
          <span className="tracking-tight">Enricher<span className="text-primary-accent">Pro</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem
            icon={FileInput}
            label="Import Items"
            id="import"
            active={activeTab === 'import'}
            onClick={onTabChange}
          />
          <NavItem
            icon={List}
            label="Analysis Results"
            id="results"
            active={activeTab === 'results'}
            onClick={onTabChange}
          />
          <NavItem
            icon={Award}
            label="Publication Readiness"
            id="publication"
            active={activeTab === 'publication'}
            onClick={onTabChange}
          />
          <div className="pt-6 mt-6 border-t border-border-subtle">
            <NavItem
              icon={Settings}
              label="System Settings"
              id="settings"
              active={activeTab === 'settings'}
              onClick={onTabChange}
            />
          </div>
        </nav>

        <div className="mt-auto pt-6 space-y-4">
          <div className="bg-card glass-card rounded-2xl p-4 border border-border-subtle">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-primary-accent" />
              <span className="text-[10px] text-primary-subtle uppercase font-bold tracking-widest">API Services</span>
            </div>
            <div className="text-primary">
              <ApiStatusIndicator compact={true} />
            </div>
          </div>

          <div className="bg-card glass-card rounded-2xl p-4 border border-border-subtle">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-primary-accent" />
              <span className="text-[10px] text-primary-subtle uppercase font-bold tracking-widest">Live Engine</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-primary font-bold truncate max-w-[140px]" title={activeEngineFormatted}>
                  {activeEngineFormatted}
                </span>
                <span className="w-2 h-2 rounded-full bg-status-success shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
              </div>
              <div className="text-[10px] text-primary-subtle font-medium uppercase tracking-wider">
                Active Orchestrator
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto px-4 py-8 md:p-12">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden bg-card/80 backdrop-blur-xl border-t border-border-subtle flex justify-around shrink-0 py-2 px-4 z-20">
        <NavItem icon={FileInput} label="Import" id="import" active={activeTab === 'import'} onClick={onTabChange} mobile />
        <NavItem icon={List} label="Results" id="results" active={activeTab === 'results'} onClick={onTabChange} mobile />
        <NavItem icon={Award} label="Publish" id="publication" active={activeTab === 'publication'} onClick={onTabChange} mobile />
        <NavItem icon={Settings} label="Settings" id="settings" active={activeTab === 'settings'} onClick={onTabChange} mobile />
      </div>
    </div>
  );
};

export default Layout;
