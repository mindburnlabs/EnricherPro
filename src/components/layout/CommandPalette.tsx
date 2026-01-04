import React, { useState, useEffect } from 'react';
import { Search, Command, FileText } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    // Fetch recent jobs/history when opened
    if (isOpen) {
      fetch('/api/jobs?limit=5')
        .then((res) => res.json())
        .then((data) => {
          const jobs = data.jobs || [];
          const mapped = jobs.map((j: any) => ({
            id: j.id,
            title: j.inputRaw || 'Untitled Search',
            type: 'history',
            action: 'research', // navigating to research
          }));

          // Static nav items
          const nav = [
            { id: 'home', title: 'Home', type: 'nav', action: 'home' },
            { id: 'dash', title: 'Dashboard', type: 'nav', action: 'dashboard' },
            { id: 'audit', title: 'Audit Log', type: 'nav', action: 'audit' },
            { id: 'settings', title: 'Settings', type: 'nav', action: 'config' },
          ];
          setResults([...nav, ...mapped]);
        })
        .catch((e) => console.error(e));
    }
  }, [isOpen]);

  const filtered = results.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className='fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4'>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={onClose} />

      <div className='relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100'>
        <div className='flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800'>
          <Search className='w-5 h-5 text-gray-400' />
          <input
            autoFocus
            type='text'
            placeholder='Type a command or search...'
            className='flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-white placeholder-gray-400'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className='hidden md:inline-flex h-6 items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 font-mono text-[10px] font-medium text-gray-500 opacity-100'>
            <span className='text-xs'>ESC</span>
          </kbd>
        </div>

        <div className='max-h-[60vh] overflow-y-auto py-2'>
          {filtered.length === 0 ? (
            <div className='p-8 text-center text-gray-500 text-sm'>No results found.</div>
          ) : (
            <div className='space-y-1 px-2'>
              {filtered.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.action);
                    onClose();
                  }}
                  className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group ${idx === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
                >
                  {item.type === 'nav' ? (
                    <Command size={18} className='text-gray-400 group-hover:text-emerald-500' />
                  ) : (
                    <FileText size={18} className='text-gray-400 group-hover:text-blue-500' />
                  )}
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                    {item.title}
                  </span>
                  {idx === 0 && <span className='ml-auto text-xs text-gray-400'>Enter</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
