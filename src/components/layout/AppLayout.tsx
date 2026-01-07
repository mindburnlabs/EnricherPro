import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  FileText,
  Settings,
  MessageSquare,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
} from 'lucide-react';
import { CommandPalette } from './CommandPalette.js';
import { StatusBar } from './StatusBar.js';
import { ItemsListSidebar } from './ItemsListSidebar.js';

interface AppLayoutProps {
  children: React.ReactNode;
  currentView: 'home' | 'jobs' | 'audit' | 'config' | 'research';
  onNavigate: (view: 'home' | 'jobs' | 'audit' | 'config' | 'research') => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentView, onNavigate }) => {
  const { t } = useTranslation('common');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCmdKOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);



  // Helper for Breadcrumbs
  const getBreadcrumbs = () => {
    const path = ['Home'];
    if (currentView !== 'home') {
      path.push(currentView.charAt(0).toUpperCase() + currentView.slice(1));
    }
    return path;
  };

  const NavItem = ({
    view,
    icon: Icon,
    label,
  }: {
    view: 'home' | 'jobs' | 'audit' | 'config' | 'research';
    icon: any;
    label: string;
  }) => (
    <button
      onClick={() => onNavigate(view)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group
                ${
                  currentView === view
                    ? 'bg-primary/10 text-primary-accent'
                    : 'text-primary-subtle hover:bg-surface hover:text-primary'
                }`}
    >
      <Icon size={20} />
      <span
        className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}
      >
        {label}
      </span>
      {/* Tooltip for collapsed state */}
      {isSidebarCollapsed && (
        <div className='absolute left-16 bg-surface border border-border-subtle px-2 py-1 rounded text-xs text-primary shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50'>
          {label}
        </div>
      )}
    </button>
  );

  return (
    <div className='flex h-screen bg-background text-primary overflow-hidden'>
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCmdKOpen}
        onClose={() => setIsCmdKOpen(false)}
        onNavigate={(v) => onNavigate(v as any)}
      />

      {/* Sidebar */}
      <aside
        className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} 
                bg-background/95 backdrop-blur border-r border-border-subtle 
                flex flex-col transition-all duration-300 relative z-20`}
      >
        {/* Header / Logo */}
        <div className='p-4 flex items-center gap-3 border-b border-border-subtle/50 h-16'>
          <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-primary-accent to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20'>
            <span className='text-white font-bold'>D²</span>
          </div>
          <span
            className={`font-bold text-lg tracking-tight transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}
          >
            Deep Discovery
          </span>
        </div>

        {/* Main Navigation */}
        <div className='flex-1 overflow-y-auto py-4 px-2 space-y-1'>
          <button
            onClick={() => onNavigate('home')}
            className='w-full flex items-center gap-2 px-3 py-2 mb-6 rounded-full border border-border-subtle hover:border-border-highlight hover:bg-surface transition-all group'
          >
            <Plus size={18} className='text-primary-accent' />
            <span
              className={`text-sm font-medium transition-opacity ${isSidebarCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}
            >
              {t('nav.new_thread', 'New Research')}
            </span>
          </button>

          <div className='space-y-1'>
            <NavItem view='home' icon={Search} label={t('nav.search', 'Search')} />
            <NavItem
              view='jobs'
              icon={LayoutDashboard}
              label={t('nav.jobs', 'Jobs')}
            />
            <NavItem view='audit' icon={FileText} label={t('nav.audit', 'Audit Log')} />
            <NavItem view='config' icon={Settings} label={t('nav.config', 'Configuration')} />
          </div>

          {/* Recent History Section */}
          {!isSidebarCollapsed && (
            <div className='mt-8 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500'>
              <h3 className='text-xs font-semibold text-primary-subtle uppercase tracking-wider mb-3 px-2'>
                {t('nav.recent', 'Recent')}
              </h3>
              <div className='space-y-1'>
                <ItemsListSidebar />
              </div>
            </div>
          )}
        </div>

        {/* Footer / User Profile */}
        <div className='p-4 border-t border-border-subtle/50'>
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className='w-8 h-8 rounded-full bg-surface border border-border-subtle flex items-center justify-center'>
              <span className='text-xs font-medium'>JD</span>
            </div>
            <div
              className={`flex flex-col transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}
            >
              <span className='text-sm font-medium'>John Doe</span>
              <span className='text-xs text-primary-subtle'>Admin</span>
            </div>
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className='absolute -right-3 top-20 bg-surface border border-border-subtle rounded-full p-1 text-primary-subtle hover:text-primary shadow-sm hover:scale-110 transition-all z-30'
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className='flex-1 overflow-hidden relative flex flex-col'>
        {/* Top Navigation */}
        <header className='h-14 border-b border-border-subtle flex items-center px-6 justify-between bg-surface/30 backdrop-blur-sm'>
          {/* ... (existing header content) ... */}
          <div className='flex items-center text-sm text-primary-subtle'>
            {getBreadcrumbs().map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={14} className='mx-2 text-border-highlight' />}
                <span
                  className={i === getBreadcrumbs().length - 1 ? 'font-medium text-primary' : ''}
                >
                  {i === 2 && currentView === 'home' ? `SKU: ${crumb}` : crumb}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className='hidden md:flex items-center gap-4 text-xs text-primary-subtle'>
            <span className='flex items-center gap-1 border border-border-subtle rounded px-1.5 py-0.5'>
              <span className='font-mono'>⌘</span> K
            </span>
            <span>to search...</span>
          </div>
        </header>

        <div className='flex-1 overflow-hidden relative'>{children}</div>

        {/* Persistent Status Bar */}
        <StatusBar />
      </main>
    </div>
  );
};
