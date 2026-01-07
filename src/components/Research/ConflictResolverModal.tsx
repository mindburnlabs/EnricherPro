import React from 'react';
import { useTranslation } from 'react-i18next';
import { EnrichedItem } from '../../types/domain.js';
import { AlertTriangle, ArrowRight, Check, Split, X, Gavel, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ConflictResolverModalProps {
  current: EnrichedItem;
  candidate: EnrichedItem;
  onResolve: (action: 'keep_current' | 'replace' | 'merge') => void;
  onCancel: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  current,
  candidate,
  onResolve,
  onCancel,
}) => {
  const { t } = useTranslation(['detail', 'common']);
  const [isJudging, setIsJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState<{
    recommendation: 'keep_current' | 'replace';
    reason: string;
  } | null>(null);

  const handleAskJudge = async () => {
    setIsJudging(true);
    // Mock AI Delay
    await new Promise((r) => setTimeout(r, 2500));

    // Mock Logic: Recommend higher confidence
    const currentConf = current.data.confidence?.overall || 0;
    const candidateConf = candidate.data.confidence?.overall || 0;

    if (candidateConf > currentConf) {
      setJudgeResult({
        recommendation: 'replace',
        reason:
          'Candidate has higher overall confidence score (85% vs 70%) and fresher data timestamp.',
      });
    } else {
      setJudgeResult({
        recommendation: 'keep_current',
        reason:
          'Current version is verified by official sources which override the new marketplace data.',
      });
    }
    setIsJudging(false);
  };

  // Helper to calculate confidence diff
  const getConfidence = (item: EnrichedItem) => (item.data.confidence?.overall || 0) * 100;

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onCancel} />

      <div className='relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-amber-50 dark:bg-amber-900/10'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600'>
              <AlertTriangle className='w-6 h-6' />
            </div>
            <div>
              <h2 className='text-xl font-bold text-gray-900 dark:text-white'>{t('governance.conflict_detected', 'Conflict Detected')}</h2>
              <p className='text-sm text-amber-700 dark:text-amber-400'>
                {t('governance.choose_version', 'Please choose which version to keep.')}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className='p-2 hover:bg-black/5 rounded-full'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        {/* Comparison Grid */}
        <div className='flex-1 overflow-y-auto p-6'>
          <div className='grid grid-cols-2 gap-8'>
            {/* Current (Left) */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='font-bold text-gray-500 uppercase tracking-wider text-xs'>
                  {t('labels.current_version')}
                </h3>
                <span className='text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300'>
                  {t('drawer.conf_short', { val: Math.round(getConfidence(current)) })}
                </span>
              </div>
              <div className='border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50'>
                <div className='space-y-3'>
                  <div>
                    <label className='text-[10px] text-gray-400'>MPN</label>
                    <div className='font-mono text-sm'>
                      {current.data.mpn_identity.mpn || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className='text-[10px] text-gray-400'>Title</label>
                    <div className='text-sm line-clamp-2'>{current.data.supplier_title_raw}</div>
                  </div>
                  <div>
                    <label className='text-[10px] text-gray-400'>Specs</label>
                    <div className='text-sm'>
                      {t('specs.yield')}: {current.data.tech_specs.yield.value || '-'}{' '}
                      {current.data.tech_specs.yield.unit || ''}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onResolve('keep_current')}
                className='w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
              >
                {t('actions.keep_current')}
              </button>
            </div>

            {/* Candidate (Right) */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='font-bold text-emerald-600 uppercase tracking-wider text-xs'>
                  {t('labels.new_candidate')}
                </h3>
                <span className='text-xs bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-emerald-600 dark:text-emerald-400'>
                  {t('drawer.conf_short', { val: Math.round(getConfidence(candidate)) })}
                </span>
              </div>
              <div className='border-2 border-emerald-500/20 rounded-xl p-4 bg-emerald-50/10 dark:bg-emerald-900/10'>
                <div className='space-y-3'>
                  <div>
                    <label className='text-[10px] text-gray-400'>MPN</label>
                    <div className='font-mono text-sm'>
                      {candidate.data.mpn_identity.mpn || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className='text-[10px] text-gray-400'>Title</label>
                    <div className='text-sm line-clamp-2'>{candidate.data.supplier_title_raw}</div>
                  </div>
                  <div>
                    <label className='text-[10px] text-gray-400'>Specs</label>
                    <div className='text-sm'>
                      {t('specs.yield')}: {candidate.data.tech_specs.yield.value || '-'}{' '}
                      {candidate.data.tech_specs.yield.unit || ''}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onResolve('replace')}
                className='w-full py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2'
              >
                <Check className='w-4 h-4' />
                {t('actions.accept_new')}
              </button>
            </div>
          </div>
        </div>

        {/* AI Judge Result Panel */}
        {judgeResult && (
          <div className='p-4 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-bottom-2'>
            <div className='flex gap-3'>
              <div className='p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg h-fit text-indigo-600'>
                <Gavel className='w-5 h-5' />
              </div>
              <div className='flex-1'>
                <h4 className='font-bold text-indigo-900 dark:text-indigo-300 mb-1'>
                  {t('judge.title', 'AI Judge Recommendation')}
                </h4>
                <p className='text-sm text-indigo-700 dark:text-indigo-400 mb-3'>
                  {judgeResult.reason}
                </p>
                <div className='flex gap-2'>
                  <button
                    onClick={() => onResolve(judgeResult.recommendation)}
                    className='px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow hover:bg-indigo-500 transition-colors'
                  >
                    {t('judge.accept', 'Accept Recommendation')}
                  </button>
                  <button
                    onClick={() => setJudgeResult(null)}
                    className='px-3 py-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors'
                  >
                    {t('judge.dismiss', 'Dismiss')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className='p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-center'>
          <button
            onClick={() => onResolve('merge')}
            className='text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors'
            title='Not implemented fully in MVP'
          >
            <Split className='w-4 h-4' />
            {t('actions.manual_merge')}
          </button>

          <div className='flex-1' />

          <button
            onClick={handleAskJudge}
            disabled={isJudging || !!judgeResult}
            className='text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50'
          >
            {isJudging ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Gavel className='w-4 h-4' />
            )}
            {isJudging ? t('judge.analyzing') : t('judge.ask')}
          </button>
        </div>
      </div>
    </div>
  );
};
