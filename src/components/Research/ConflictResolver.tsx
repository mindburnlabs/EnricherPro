import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldEvidence } from '../../types/domain.js';
import { AlertTriangle, Check, ExternalLink, ShieldAlert, Split } from 'lucide-react';

interface ConflictResolverProps {
  fieldKey: string;
  evidence: FieldEvidence<any>;
  onResolve: (value: any, method: 'manual' | 'source') => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  fieldKey,
  evidence,
  onResolve,
}) => {
  const { t } = useTranslation(['detail', 'common']);

  // If no conflicts, return null
  if (
    !evidence.is_conflict ||
    !evidence.conflicting_values ||
    evidence.conflicting_values.length === 0
  ) {
    return null;
  }

  const currentValue = {
    value: evidence.value,
    source: evidence.source_url,
    confidence: evidence.confidence,
    timestamp: evidence.timestamp,
  };

  return (
    <div className='bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg p-4 mb-4'>
      <div className='flex items-center gap-2 mb-3'>
        <ShieldAlert className='w-5 h-5 text-amber-600 dark:text-amber-400' />
        <h4 className='font-bold text-amber-800 dark:text-amber-200'>
          {t('governance.conflict_detected', 'Data Conflict Detected')}
        </h4>
      </div>

      <p className='text-xs text-amber-700 dark:text-amber-300 mb-4'>
        {t(
          'governance.conflict_desc',
          'Multiple trusted sources reported different values for this field. Please select the correct value.',
        )}
      </p>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Column A: Current/Primary Value */}
        <div className='bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 relative group hover:border-blue-400 transition-colors'>
          <div className='absolute top-2 right-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] rounded text-gray-500'>
            {t('labels.current_version')}
          </div>
          <div className='text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 break-words'>
            {String(currentValue.value)}
          </div>
          <div className='flex items-center gap-2 text-xs text-gray-500 mb-3'>
            {currentValue.source ? (
              <a
                href={currentValue.source}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-1 hover:text-blue-500'
              >
                <ExternalLink className='w-3 h-3' />
                {new URL(currentValue.source).hostname}
              </a>
            ) : (
              <span>{t('drawer.unknown_source')}</span>
            )}
            <span>•</span>
            <span>{Math.round(currentValue.confidence * 100)}% Conf.</span>
          </div>
          <button
            onClick={() => onResolve(currentValue.value, 'source')}
            className='w-full py-1.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-gray-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors'
          >
            <Check className='w-3 h-3' />
            {t('governance.confirm_current', 'Confirm This Value')}
          </button>
        </div>

        {/* Column B: Conflicting Values */}
        {evidence.conflicting_values.map((conflict, idx) => (
          <div
            key={idx}
            className='bg-white dark:bg-gray-800 p-3 rounded border border-amber-200 dark:border-amber-900/50 relative group hover:border-amber-400 transition-colors'
          >
            <div className='absolute top-2 right-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-[10px] rounded text-amber-700 dark:text-amber-400'>
              {t('drawer.conflict')}
            </div>
            <div className='text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 break-words'>
              {String(conflict.value)}
            </div>
            <div className='flex items-center gap-2 text-xs text-gray-500 mb-3'>
              {conflict.source?.url ? (
                <a
                  href={conflict.source.url}
                  target='_blank'
                  rel='noreferrer'
                  className='flex items-center gap-1 hover:text-blue-500'
                >
                  <ExternalLink className='w-3 h-3' />
                  {new URL(conflict.source.url).hostname}
                </a>
              ) : (
                <span>{t('drawer.unknown_source')}</span>
              )}
              <span>•</span>
              <span>{Math.round(conflict.confidence * 100)}% Conf.</span>
            </div>
            <button
              onClick={() => onResolve(conflict.value, 'manual')}
              className='w-full py-1.5 bg-amber-50 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-amber-900/20 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 text-xs font-semibold rounded flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 transition-colors'
            >
              <Split className='w-3 h-3' />
              {t('governance.select_alternative', 'Select Alternative')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
