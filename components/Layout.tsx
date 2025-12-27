
import React, { useState, useEffect } from 'react';
import { FileInput, List, Database, Settings, ShieldCheck } from 'lucide-react';
import { getFirecrawlApiKey } from '../services/firecrawlService';

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
        ? `flex-1 flex flex-col items-center justify-center py-2 px-1 transition-all ${
            active ? 'text-indigo-600 scale-110' : 'text-slate-400'
          }`
        : `w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all rounded-xl mb-1 ${
            active
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
    // Listen for changes in localStorage to update status dot
    window.addEventListener('storage', checkKeys);
    return () => window.removeEventListener('storage', checkKeys);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#f8fafc] h-[100dvh]">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 bg-slate-900 flex-shrink-0 flex-col h-full border-r border-slate-800 p-6">
        <div className="flex items-center gap-3 text-white font-bold text-xl mb-10 px-2">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg">
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
          <div className="pt-6 mt-6 border-t border-slate-800">
            <NavItem 
              icon={Settings} 
              label="System Settings" 
              id="settings" 
              active={activeTab === 'settings'} 
              onClick={onTabChange} 
            />
          </div>
        </nav>

        <div className="mt-auto pt-6">
           <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
             <div className="flex items-center gap-2 mb-3">
               <ShieldCheck size={16} className="text-indigo-400" />
               <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Live Engine</span>
             </div>
             <div className="space-y-2">
               <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-300 font-medium">Gemini 3 Pro</span>
                 <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-300 font-medium">Firecrawl v2</span>
                 <span className={`w-2 h-2 rounded-full transition-all duration-500 ${isFirecrawlReady ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></span>
               </div>
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden bg-white/80 glass border-t border-slate-100 flex justify-around shrink-0 py-2 px-4 z-20 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
          <NavItem icon={FileInput} label="Import" id="import" active={activeTab === 'import'} onClick={onTabChange} mobile />
          <NavItem icon={List} label="Results" id="results" active={activeTab === 'results'} onClick={onTabChange} mobile />
          <NavItem icon={Settings} label="Settings" id="settings" active={activeTab === 'settings'} onClick={onTabChange} mobile />
      </div>
    </div>
  );
};

export default Layout;
