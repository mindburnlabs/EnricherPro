import React, { useState } from 'react';
import { EnrichedItem } from '../../types/domain.js';
import {
  Check,
  AlertTriangle,
  ExternalLink,
  Box,
  Layers,
  Download,
  FileJson,
  Loader2,
  RefreshCcw,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CompletenessMeter } from '../Research/CompletenessMeter.js';

interface ChatResultBlockProps {
  items: EnrichedItem[];
  onApprove: (id: string) => Promise<void>;
  onMerge?: (item: EnrichedItem) => void;
  onRefresh?: () => void;
  onSelectItem: (item: EnrichedItem) => void;
  status: 'running' | 'completed' | 'failed';
}

export const ChatResultBlock: React.FC<ChatResultBlockProps> = ({
  items,
  onApprove,
  onMerge,
  onRefresh,
  onSelectItem,
  status,
}) => {
  const { t } = useTranslation('research');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  const handleDownload = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', dataStr);
      downloadAnchorNode.setAttribute('download', `research_results_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else {
      const headers = t('results.csv_headers', 'ID, MPN, Brand, Model, Confidence, Status').split(
        ', ',
      );
      const rows = items.map((i) => [
        i.id,
        i.data.mpn_identity.mpn,
        i.data.brand,
        i.data.model,
        i.data.confidence?.overall,
        i.status,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        headers.join(',') +
        '\n' +
        rows.map((e) => e.join(',')).join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `research_results_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const handleApproveClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setApprovingId(id);
    await onApprove(id);
    setApprovingId(null);
  };

  // --- List View ---
  return (
    <div className='mt-8 space-y-4 animate-in slide-in-from-bottom-4 duration-500 delay-100'>
      <div className='flex items-center justify-between pl-1 mb-2'>
        <div className='flex items-center gap-2'>
          <Box className='w-4 h-4 text-emerald-500' />
          <h3 className='text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest'>
            {t('results.title', 'Research Findings')}
          </h3>
        </div>
        <div className='flex gap-2'>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-2 border border-transparent hover:border-blue-100'
              title={t('results.refresh_data', 'Force Refresh Data')}
            >
              <RefreshCcw className='w-4 h-4' />
            </button>
          )}
          <button
            onClick={() => handleDownload('csv')}
            className='p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors'
            title={t('results.download_csv', 'Download CSV')}
          >
            <Download className='w-4 h-4' />
          </button>
          <button
            onClick={() => handleDownload('json')}
            className='p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors'
            title={t('results.download_json', 'Download JSON')}
          >
            <FileJson className='w-4 h-4' />
          </button>
        </div>
      </div>

      <div className='grid gap-4 grid-cols-1 md:grid-cols-2'>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectItem(item)}
            className='group relative rounded-2xl p-5 border border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-gray-800/20 backdrop-blur-xl hover:bg-white/60 dark:hover:bg-gray-800/40 hover:border-emerald-500/30 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 overflow-hidden cursor-pointer flex flex-col'
          >
            {/* Background Gradient Effect */}
            <div className='absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-emerald-50/0 dark:from-emerald-900/0 dark:to-emerald-900/0 group-hover:from-emerald-50/20 dark:group-hover:from-emerald-900/10 transition-colors duration-500' />

            <div className='relative z-10 flex flex-col h-full'>
              {/* Header Status Row */}
              <div className='flex justify-between items-start mb-4'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-lg bg-gray-100/80 dark:bg-gray-700/50 flex items-center justify-center text-gray-500 border border-gray-200/50 dark:border-gray-600/30'>
                    <Layers className='w-4 h-4' />
                  </div>

                  {(item.data.confidence?.overall || 0) > 85 && (
                    <div
                      className='flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                      title='High Confidence'
                    >
                      <Check className='w-3 h-3' />
                      {t('results.verified', 'Verified')}
                    </div>
                  )}

                  {(item.data as any)._evidence?.is_graph_verified && (
                    <div
                      className='flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30'
                      title={t('results.graph_hit', 'Graph Hit')}
                    >
                      <Zap className='w-3 h-3' />
                      {t('results.graph_hit', 'Graph Hit')}
                    </div>
                  )}
                </div>

                <span
                  className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm border ${
                    (item.status as any) === 'needs_review'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
                      : (item.status as any) === 'processing'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30 animate-pulse'
                        : (item.status as any) === 'failed'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                          : (item.status as any) === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                            : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                  }`}
                >
                  {(item.status as any) === 'needs_review' && <AlertTriangle className='w-3 h-3' />}
                  {(item.status as any) === 'processing' && (
                    <Loader2 className='w-3 h-3 animate-spin' />
                  )}
                  {t(`status.${item.status}`, (item.status as string).replace('_', ' ')) as string}
                </span>
              </div>

              {/* Title & Desc */}
              <div className='mb-4'>
                <h4 className='font-bold text-lg text-gray-900 dark:text-gray-100 leading-tight mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors break-words'>
                  {item.data.mpn_identity.mpn || t('review.unknown_mpn', 'Unknown MPN')}
                </h4>
                <p className='text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed'>
                  {item.data.mpn_identity.canonical_model_name}
                </p>
              </div>

              {/* Core Specs Grid */}
              <div className='grid grid-cols-2 gap-2 mb-4'>
                <div className='bg-gray-50/80 dark:bg-gray-900/40 rounded-lg p-2 border border-gray-100 dark:border-gray-800/50'>
                  <div className='text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5'>
                    {t('specs.brand', 'Brand')}
                  </div>
                  <div className='text-xs font-semibold text-gray-700 dark:text-gray-300 truncate'>
                    {item.data.brand || t('common.na', 'N/A')}
                  </div>
                </div>
                <div className='bg-gray-50/80 dark:bg-gray-900/40 rounded-lg p-2 border border-gray-100 dark:border-gray-800/50'>
                  <div className='text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5'>
                    {t('specs.type', 'Type')}
                  </div>
                  <div className='text-xs font-semibold text-gray-700 dark:text-gray-300 truncate'>
                    {item.data.consumable_type || t('common.na', 'N/A')}
                  </div>
                </div>
              </div>

              {/* Expanded Info: Logistics, FAQ, Compliance Highlights */}
              <div className='flex flex-wrap gap-2 mb-4 items-center'>
                {/* Compat Meter */}
                <CompletenessMeter data={item.data} compact />

                {/* Logistics Badge */}
                {(item.data.logistics?.package_weight_g || (item.data as any).weight_g) && (
                  <div
                    className='px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1'
                    title={t('results.logistics_badge', 'Logistics Data Only')}
                  >
                    <Box className='w-3 h-3' />
                    {item.data.logistics?.package_weight_g || (item.data as any).weight_g}
                    {t('results.logistics_unit_g', 'g')}
                  </div>
                )}

                {/* Compliance / RU Specifics */}
                {(item.data as any).compliance_ru?.tn_ved_code && (
                  <div className='px-2 py-1 rounded-md bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/30 text-[10px] font-medium text-teal-700 dark:text-teal-300 flex items-center gap-1'>
                    <div className='w-3 h-3 bg-teal-200 rounded-sm'></div>
                    {t('results.tn_ved', 'TN VED')}
                  </div>
                )}
              </div>

              {/* Evidence / Screenshot */}
              {(item.data._evidence?.screenshot ||
                Object.keys(item.data._evidence || {}).length > 0) && (
                <div className='mb-4 flex gap-2'>
                  {(item.data._evidence as any)?.screenshot?.value && (
                    <div className='relative w-16 h-12 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden group/img cursor-pointer shrink-0'>
                      <img
                        src={(item.data._evidence as any).screenshot.value}
                        alt='Source'
                        className='w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110'
                      />
                    </div>
                  )}
                  <div className='flex-1 flex flex-col justify-center min-w-0'>
                    <div className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 px-0.5'>
                      {t('evidence.title', 'Evidence')}
                    </div>
                    <div className='flex items-center gap-1.5'>
                      <div className='flex -space-x-1.5 shrink-0'>
                        {[1, 2, 3]
                          .slice(0, Math.min(3, Object.keys(item.data._evidence || {}).length))
                          .map((i) => (
                            <div
                              key={i}
                              className='w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900 border border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-emerald-700 dark:text-emerald-400'
                            />
                          ))}
                      </div>
                      <span className='text-xs text-gray-500 truncate'>
                        {Object.keys(item.data._evidence || {}).length}{' '}
                        {t('results.verified_points', 'Verified Points')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className='mt-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800/50'>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectItem(item);
                  }}
                  className='px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 flex-1'
                >
                  <ExternalLink className='w-3.5 h-3.5 shrink-0' />
                  <span className='truncate'>{t('actions.details', 'Details')}</span>
                </button>

                <button
                  onClick={(e) => handleApproveClick(item.id, e)}
                  disabled={approvingId === item.id || item.status === 'published'}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 flex-[1.5] ${
                    item.status === 'published'
                      ? 'bg-emerald-100 text-emerald-700 cursor-default'
                      : 'text-white bg-gray-900 dark:bg-white dark:text-black hover:bg-emerald-600 dark:hover:bg-emerald-400 hover:shadow-emerald-500/20'
                  } ${approvingId === item.id ? 'animate-pulse' : ''}`}
                >
                  {approvingId === item.id ? (
                    <>
                      <Loader2 className='w-3.5 h-3.5 animate-spin shrink-0' />
                      <span className='truncate'>{t('actions.approving', 'Approving...')}</span>
                    </>
                  ) : item.status === 'published' ? (
                    <>
                      <Check className='w-3.5 h-3.5 shrink-0' />
                      <span className='truncate'>{t('actions.approved', 'Approved')}</span>
                    </>
                  ) : (
                    <>
                      <Check className='w-3.5 h-3.5 shrink-0' />
                      <span className='truncate'>{t('actions.approve', 'Approve')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
