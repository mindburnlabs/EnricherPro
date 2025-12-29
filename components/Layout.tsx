
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
        ? `flex-1 flex flex-col items-center justify-center py-2 px-1 transition-all ${active ? 'text-indigo-400 scale-110' : 'text-slate-400'
        }`
        : `w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all rounded-xl mb-1 ${active
          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-900/20'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`
    }
  >
    <Icon size={mobile ? 22 : 18} />
    <span className={mobile ? 'text-[10px] mt-1' : ''}>{label}</span>
  </button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [isFirecrawlReady, setIsFirecrawlReady] = useState(false);

  const checkKeys = () => {
    const fcKey = getFirecrawlApiKey();
    setIsFirecrawlReady(!!fcKey && fcKey.startsWith('fc-'));
  };

  useEffect(() => {
    checkKeys();
    window.addEventListener('storage', checkKeys);
    return () => window.removeEventListener('storage', checkKeys);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#0f172a] h-[100dvh]">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 glass-sidebar flex-shrink-0 flex-col h-full p-6">
        <div className="flex items-center gap-3 text-white font-bold text-xl mb-10 px-2">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-xl shadow-indigo-900/20">
            <Database size={24} />
          </div>
          <span className="tracking-tight">Enricher<span className="text-indigo-400">Pro</span></span>
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
          <div className="pt-6 mt-6 border-t border-white/5">
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
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-indigo-400" />
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">API Services</span>
            </div>
            <div className="text-white">
              <ApiStatusIndicator compact={true} />
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-indigo-400" />
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Live Engine</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Gemini 3 Pro</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Firecrawl v2</span>
                <span className={`w-2 h-2 rounded-full transition-all duration-500 ${isFirecrawlReady ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}></span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute inset-0 bg-[#0f172a] -z-10"></div>
        <div className="flex-1 overflow-y-auto px-4 py-8 md:p-12">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden bg-slate-900/80 backdrop-blur-xl border-t border-white/5 flex justify-around shrink-0 py-2 px-4 z-20">
        <NavItem icon={FileInput} label="Import" id="import" active={activeTab === 'import'} onClick={onTabChange} mobile />
        <NavItem icon={List} label="Results" id="results" active={activeTab === 'results'} onClick={onTabChange} mobile />
        <NavItem icon={Award} label="Publish" id="publication" active={activeTab === 'publication'} onClick={onTabChange} mobile />
        <NavItem icon={Settings} label="Settings" id="settings" active={activeTab === 'settings'} onClick={onTabChange} mobile />
      </div>
    </div>
  );
};

export default Layout;
