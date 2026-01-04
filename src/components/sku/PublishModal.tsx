import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, XCircle, Share, ExternalLink, Download } from 'lucide-react';
import { EnrichedItem } from '../../types/domain.js';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: EnrichedItem;
  onPublish: (target: 'ozon' | 'yandex' | 'wb') => Promise<void>;
}

export const PublishModal: React.FC<PublishModalProps> = ({ isOpen, onClose, item, onPublish }) => {
  const { t } = useTranslation('common');
  const [isPublishing, setIsPublishing] = useState(false);
  const [target, setTarget] = useState<'ozon' | 'yandex' | 'wb'>('ozon');
  const [format, setFormat] = useState<'json' | 'csv' | 'xml'>('json');
  const [step, setStep] = useState<'checklist' | 'success'>('checklist');

  if (!isOpen) return null;

  // Mock Validation Logic
  const validations = [
    { label: 'Required fields complete', status: 'pass' },
    { label: 'No unresolved conflicts', status: item.reviewReason ? 'fail' : 'pass' },
    { label: 'Images pass QC', status: 'pass' },
    { label: 'Compatibility verified', status: 'pass' },
    { label: 'TNVED code present', status: target === 'wb' ? 'warn' : 'pass' },
  ];

  const hasErrors = validations.some((v) => v.status === 'fail');
  const hasWarnings = validations.some((v) => v.status === 'warn');

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish(target);
      setStep('success');
    } catch (e) {
      console.error(e);
      alert('Publishing failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `product_export_${target}_${timestamp}.${format}`;

    let content = '';
    if (format === 'json') {
      content = JSON.stringify(item, null, 2);
    } else if (format === 'csv') {
      const headers = 'ID,MPN,Title,Brand,Category,Price\n';
      const row = `${item.id},${item.data.mpn_identity.mpn},"${item.data.supplier_title_raw}",${item.data.brand},${item.data.consumable_type},0\n`;
      content = headers + row;
    } else {
      content = `<product>\n  <id>${item.id}</id>\n  <mpn>${item.data.mpn_identity.mpn}</mpn>\n  <target>${target}</target>\n</product>`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />

      <div className='relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50'>
          <div>
            <h2 className='text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <Share className='w-5 h-5 text-emerald-600' />
              Publish Product
            </h2>
            <p className='text-sm text-gray-500'>Preparing to export to marketplace</p>
          </div>
          <button onClick={onClose} className='p-2 hover:bg-black/5 rounded-full'>
            <XCircle className='w-6 h-6 text-gray-400' />
          </button>
        </div>

        <div className='p-6'>
          {step === 'checklist' ? (
            <div className='space-y-6'>
              {/* Channel Selector */}
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block'>
                  Target Marketplace
                </label>
                <div className='flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1'>
                  {['ozon', 'yandex', 'wb'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTarget(m as any)}
                      className={`flex-1 py-2 text-sm font-bold capitalize rounded-md transition-all ${target === m ? 'bg-white dark:bg-gray-700 shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Format Selector */}
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block'>
                  Export Format
                </label>
                <div className='flex gap-2'>
                  {['json', 'csv', 'xml'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f as any)}
                      className={`px-3 py-1 text-xs font-bold uppercase rounded border transition-colors ${format === f ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div className='space-y-3'>
                {validations.map((v, i) => (
                  <div
                    key={i}
                    className='flex items-center justify-between text-sm p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30'
                  >
                    <span className='font-medium text-gray-700 dark:text-gray-300'>{v.label}</span>
                    {v.status === 'pass' && (
                      <span className='text-emerald-500 flex items-center gap-1 font-bold text-xs'>
                        <CheckCircle size={14} /> PASS
                      </span>
                    )}
                    {v.status === 'warn' && (
                      <span className='text-amber-500 flex items-center gap-1 font-bold text-xs'>
                        <AlertTriangle size={14} /> WARNING
                      </span>
                    )}
                    {v.status === 'fail' && (
                      <span className='text-red-500 flex items-center gap-1 font-bold text-xs'>
                        <XCircle size={14} /> BLOCKER
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className='pt-4 flex gap-3'>
                <button
                  onClick={onClose}
                  className='flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors'
                >
                  Cancel
                </button>
                <button
                  onClick={handlePublish}
                  disabled={hasErrors || isPublishing}
                  className='flex-[2] py-3 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all'
                >
                  {isPublishing
                    ? 'Publishing...'
                    : hasErrors
                      ? 'Fix Blockers First'
                      : hasWarnings
                        ? 'Publish with Warnings'
                        : 'Publish Now'}
                </button>
              </div>
            </div>
          ) : (
            <div className='text-center py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4'>
              <div className='w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600'>
                <CheckCircle className='w-8 h-8' />
              </div>
              <div>
                <h3 className='text-2xl font-bold text-gray-900 dark:text-white'>
                  Successfully Published!
                </h3>
                <p className='text-gray-500 mt-2'>Product is now live on {target.toUpperCase()}.</p>
              </div>

              <div className='flex gap-3 justify-center'>
                <button className='px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-200 transition'>
                  <ExternalLink size={16} /> View Listing
                </button>
                <button
                  onClick={handleDownload}
                  className='px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-200 transition'
                >
                  <Download size={16} /> Download {format.toUpperCase()}
                </button>
              </div>

              <button onClick={onClose} className='text-sm text-gray-400 hover:underline'>
                Close Window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
