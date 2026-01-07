import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info, ExternalLink, ShieldCheck, Clock } from 'lucide-react';

interface EvidenceTooltipProps {
  evidence?: {
    value?: any;
    raw_snippet?: string;
    source_url?: string;
    confidence?: number;
    timestamp?: string;
  } | null;
  label: string;
  children: React.ReactNode;
}

export const EvidenceTooltip: React.FC<EvidenceTooltipProps> = ({ evidence, label, children }) => {
  const { t } = useTranslation('detail');
  if (!evidence) return <>{children}</>;

  return (
    <div className='group relative inline-block'>
      <div
        className={`cursor-help decoration-dotted decoration-gray-400 underline-offset-4 ${evidence.confidence && evidence.confidence > 0.8 ? 'decoration-emerald-400' : 'decoration-amber-400'}`}
      >
        {children}
      </div>

      <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-gray-700'>
        <div className='font-bold flex items-center justify-between border-b border-gray-700 pb-2 mb-2'>
          <span>{t('tooltip.evidence_title', { label })}</span>
          {evidence.confidence && (
            <span
              className={`flex items-center gap-1 ${evidence.confidence > 0.8 ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              <ShieldCheck className='w-3 h-3' />
              {Math.round(evidence.confidence * 100)}%
            </span>
          )}
        </div>

        {evidence.source_url && (
          <div className='mb-2'>
            <span className='text-gray-400 block mb-0.5'>{t('tooltip.source')}</span>
            <span className='truncate block text-blue-300 max-w-full'>
              {new URL(evidence.source_url).hostname}
            </span>
          </div>
        )}

        {evidence.raw_snippet && (
          <div className='mb-2 bg-gray-800 p-2 rounded border border-gray-700 italic text-gray-300'>
            "{evidence.raw_snippet.slice(0, 100)}
            {evidence.raw_snippet.length > 100 ? '...' : ''}"
          </div>
        )}

        {evidence.timestamp && (
          <div className='flex items-center gap-1 text-gray-500 mt-2 justify-end'>
            <Clock className='w-3 h-3' />
            {new Date(evidence.timestamp).toLocaleTimeString()}
          </div>
        )}

        {/* Arrow */}
        <div className='absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900'></div>
      </div>
    </div>
  );
};
