import React from 'react';
import { Activity, DollarSign, CloudLightning } from 'lucide-react';

import { useResearchStream } from '../../hooks/useResearchStream.js';

export const StatusBar: React.FC = () => {
  const { status, steps } = useResearchStream();

  const isRunning = status === 'running';
  const progress =
    steps.length > 0
      ? (steps.filter((s) => s.status === 'completed').length / steps.length) * 100
      : 0;

  return (
    <div className='h-8 bg-surface border-t border-border-subtle flex items-center justify-between px-4 text-[10px] text-primary-subtle select-none'>
      {/* Left: Status */}
      <div className='flex items-center gap-4'>
        <span className='flex items-center gap-1.5'>
          <span
            className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'} `}
          />
          {isRunning ? 'Processing Job...' : 'System Ready'}
        </span>
        <span className='hidden md:inline-flex items-center gap-1'>
          <CloudLightning size={12} />
          Connected to US-East-1
        </span>
      </div>

      {/* Center: Progress */}
      {isRunning && (
        <div className='hidden md:flex items-center gap-2 w-1/3 animate-in fade-in'>
          <span className='whitespace-nowrap'>Job Progress</span>
          <div className='h-1.5 flex-1 bg-surface-highlight rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary-accent rounded-full transition-all duration-300'
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Right: Metrics */}
      <div className='flex items-center gap-4 font-mono'>
        <span
          className='flex items-center gap-1 hover:text-primary transition-colors cursor-help'
          title='Tokens used in current session'
        >
          <Activity size={12} />
          12.5k / 50k
        </span>
        <span
          className='flex items-center gap-1 hover:text-primary transition-colors cursor-help'
          title='Estimated cost'
        >
          <DollarSign size={12} />
          0.023
        </span>
      </div>
    </div>
  );
};
