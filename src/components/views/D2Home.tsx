import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, ArrowRight, Zap, Globe, FileText } from 'lucide-react';

interface D2HomeProps {
  onSearch: (query: string) => void;
}

export const D2Home: React.FC<D2HomeProps> = ({ onSearch }) => {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const suggestions = [
    'Find specs for HP CF226X',
    'Compare Canon 057 vs 057H',
    'Compatible printers for Brother TN-2420',
    'Weight of Kyocera TK-1150',
  ];

  return (
    <div className='flex-1 flex flex-col items-center justify-center p-4 min-h-full relative overflow-hidden'>
      {/* Ambient Background Glow */}
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-accent/5 rounded-full blur-3xl pointer-events-none' />

      {/* Main Content */}
      <div className='w-full max-w-2xl z-10 flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700'>
        {/* Hero Title */}
        <div className='text-center space-y-2'>
          <h1 className='text-4xl font-bold tracking-tight text-primary'>
            {t('home.greeting', 'What are we enriching today?')}
          </h1>
          <p className='text-primary-subtle text-lg'>
            {t('home.subtitle', 'Deep Discovery Agent v3.0')}
          </p>
        </div>

        {/* Search Bar Container */}
        <div
          className={`w-full relative transition-all duration-300 ${isFocused ? 'scale-105' : 'scale-100'}`}
        >
          <form onSubmit={handleSubmit} className='relative group'>
            <div className='absolute inset-0 bg-gradient-to-r from-primary-accent via-indigo-500 to-primary-accent rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500'></div>
            <div className='relative bg-surface border border-border-subtle rounded-xl shadow-2xl flex items-center p-2 transition-colors focus-within:border-border-highlight focus-within:ring-1 focus-within:ring-primary-accent/50'>
              <div className='pl-4 text-primary-subtle'>
                <Search size={24} />
              </div>
              <input
                type='text'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={t(
                  'home.placeholder',
                  'Enter a supplier string (e.g. "HP 26X Toner")...',
                )}
                className='w-full bg-transparent border-none outline-none px-4 py-3 text-lg placeholder:text-primary-subtle/50 text-primary'
                autoFocus
              />
              <button
                type='submit'
                disabled={!query.trim()}
                className='p-2 rounded-lg bg-primary-subtle/10 text-primary-subtle hover:bg-primary-accent hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </form>
        </div>

        {/* Suggestions / Capabilities */}
        <div
          className='grid grid-cols-2 md:grid-cols-4 gap-3 w-full opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-forwards'
          style={{ animationFillMode: 'forwards' }}
        >
          <div className='p-3 rounded-lg border border-border-subtle bg-surface/50 hover:bg-surface hover:border-primary-accent/30 transition cursor-pointer flex flex-col items-center text-center gap-2 group'>
            <div className='p-2 rounded-full bg-primary-subtle/10 group-hover:bg-primary-accent/10 transition text-primary-accent'>
              <Globe size={16} />
            </div>
            <span className='text-xs font-medium text-primary-subtle group-hover:text-primary'>
              Global Sources
            </span>
          </div>
          <div className='p-3 rounded-lg border border-border-subtle bg-surface/50 hover:bg-surface hover:border-primary-accent/30 transition cursor-pointer flex flex-col items-center text-center gap-2 group'>
            <div className='p-2 rounded-full bg-primary-subtle/10 group-hover:bg-primary-accent/10 transition text-primary-accent'>
              <Zap size={16} />
            </div>
            <span className='text-xs font-medium text-primary-subtle group-hover:text-primary'>
              Real-Time
            </span>
          </div>
          <div className='p-3 rounded-lg border border-border-subtle bg-surface/50 hover:bg-surface hover:border-primary-accent/30 transition cursor-pointer flex flex-col items-center text-center gap-2 group'>
            <div className='p-2 rounded-full bg-primary-subtle/10 group-hover:bg-primary-accent/10 transition text-primary-accent'>
              <FileText size={16} />
            </div>
            <span className='text-xs font-medium text-primary-subtle group-hover:text-primary'>
              PDF Mining
            </span>
          </div>
          <div className='p-3 rounded-lg border border-border-subtle bg-surface/50 hover:bg-surface hover:border-primary-accent/30 transition cursor-pointer flex flex-col items-center text-center gap-2 group'>
            <div className='p-2 rounded-full bg-primary-subtle/10 group-hover:bg-primary-accent/10 transition text-primary-accent'>
              <Sparkles size={16} />
            </div>
            <span className='text-xs font-medium text-primary-subtle group-hover:text-primary'>
              Auto-Resolve
            </span>
          </div>
        </div>

        {/* Example Pills */}
        <div className='flex flex-wrap justify-center gap-2 mt-4'>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setQuery(s)}
              className='text-xs px-3 py-1.5 rounded-full border border-border-subtle text-primary-subtle hover:border-primary-accent hover:text-primary transition bg-surface/40'
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className='absolute bottom-4 text-xs text-primary-subtle/50'>
        D² Platform. Powered by Advanced Agentic Intelligence.
      </div>
    </div>
  );
};
