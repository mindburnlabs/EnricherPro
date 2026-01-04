import React from 'react';
import { X, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: any; // Type: FieldEvidence<any> | null
  fieldLabel: string;
  onConfirm?: (evidence: any) => void;
  onReject?: (evidence: any) => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  isOpen,
  onClose,
  evidence,
  fieldLabel,
  onConfirm,
  onReject,
}) => {
  if (!isOpen || !evidence) return null;

  // Handle both legacy array and new FieldEvidence object
  const isLegacyArray = Array.isArray(evidence);
  // Unified Proof handling
  const proofs = isLegacyArray
    ? evidence
    : [
        {
          rawSnippet: evidence.raw_snippet,
          sourceUrl: evidence.source_url || (evidence.urls && evidence.urls[0]),
          confidence: evidence.confidence,
          timestamp: evidence.timestamp,
          urls: evidence.urls || (evidence.source_url ? [evidence.source_url] : []),
          method: evidence.method,
          isConflict: evidence.is_conflict,
        },
      ];

  return (
    <div className='fixed inset-0 z-[60] flex justify-end'>
      {/* Backdrop */}
      <div className='absolute inset-0 bg-black/20 backdrop-blur-sm' onClick={onClose} />

      {/* Drawer */}
      <div className='relative w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl h-full p-6 overflow-y-auto animate-in slide-in-from-right duration-300'>
        <button
          onClick={onClose}
          className='absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full'
        >
          <X className='w-5 h-5' />
        </button>

        <h3 className='text-xl font-semibold mb-2 pr-8 capitalize'>
          {fieldLabel.replace(/_/g, ' ')}
        </h3>
        <p className='text-gray-500 text-sm mb-6'>
          Verified from {evidence.urls?.length || proofs.length} sources
        </p>

        <div className='space-y-6'>
          {proofs.map((ev: any, idx: number) => {
            const confPercent = (ev.confidence > 1 ? ev.confidence : ev.confidence * 100) || 0;
            return (
              <div
                key={idx}
                className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border relative overflow-hidden group hover:border-emerald-500/50 transition-colors ${ev.isConflict ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center gap-2'>
                    {ev.isConflict ? (
                      <span className='bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1'>
                        <AlertTriangle className='w-3 h-3' /> CONFLICT
                      </span>
                    ) : confPercent > 80 ? (
                      <span className='bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1'>
                        <ShieldCheck className='w-3 h-3' /> VERIFIED
                      </span>
                    ) : (
                      <span className='bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded'>
                        UNVERIFIED
                      </span>
                    )}
                    <span className='text-xs text-gray-400 font-mono'>{confPercent}% Conf.</span>
                  </div>
                  <div className='w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                    <div
                      className={`h-full ${confPercent > 80 ? 'bg-emerald-500' : confPercent > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${confPercent}%` }}
                    />
                  </div>
                </div>

                <p className='text-gray-800 dark:text-gray-200 text-sm mb-4 leading-relaxed font-mono bg-white dark:bg-gray-900 p-3 rounded border border-gray-100 dark:border-gray-800 italic'>
                  "{ev.rawSnippet || 'Evidence captured via semantic extraction.'}"
                </p>

                {ev.method && (
                  <p className='text-xs text-gray-500 mb-2 uppercase font-semibold'>
                    Method: {ev.method}
                  </p>
                )}

                <div className='space-y-1'>
                  {(ev.urls || (ev.sourceUrl ? [ev.sourceUrl] : [])).map(
                    (url: string, i: number) => (
                      <a
                        key={i}
                        href={url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate py-1'
                      >
                        <ExternalLink className='w-3 h-3' />
                        {new URL(url).hostname}
                        <span className='text-gray-400 text-[10px] ml-auto'>
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </a>
                    ),
                  )}
                </div>

                {/* Verification Actions */}
                <div className='mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2'>
                  <button
                    onClick={() => onConfirm && onConfirm(ev)}
                    className='flex-1 py-1.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded transition-colors'
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onReject && onReject(ev)}
                    className='flex-1 py-1.5 text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors'
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
