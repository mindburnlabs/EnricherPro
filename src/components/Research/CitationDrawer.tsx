
import React from 'react';
import { X, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

interface CitationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    evidence: any; // Type: FieldEvidence<any> | null
    fieldLabel: string;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ isOpen, onClose, evidence, fieldLabel }) => {
    if (!isOpen || !evidence) return null;

    // Handle both legacy array and new FieldEvidence object
    const isLegacyArray = Array.isArray(evidence);
    // Unified Proof handling
    const proofs = isLegacyArray ? evidence : [{
        rawSnippet: evidence.raw_snippet,
        sourceUrl: evidence.source_url || (evidence.urls && evidence.urls[0]),
        confidence: evidence.confidence,
        timestamp: evidence.timestamp,
        urls: evidence.urls || (evidence.source_url ? [evidence.source_url] : []),
        method: evidence.method,
        isConflict: evidence.is_conflict
    }];

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl h-full p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-semibold mb-2 pr-8 capitalize">{fieldLabel.replace(/_/g, ' ')}</h3>
                <p className="text-gray-500 text-sm mb-6">
                    Verified from {evidence.urls?.length || proofs.length} sources
                </p>

                <div className="space-y-6">
                    {proofs.map((ev: any, idx: number) => (
                        <div key={idx} className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border relative overflow-hidden group hover:border-emerald-500/50 transition-colors ${ev.isConflict ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'}`}>
                            {(ev.confidence > 0.8 || ev.confidence > 80) && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> HIGH CONFIDENCE
                                </div>
                            )}

                            {ev.isConflict && (
                                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> CONFLICT
                                </div>
                            )}

                            <p className="text-gray-800 dark:text-gray-200 text-sm mb-3 leading-relaxed font-mono bg-white dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                                "{ev.rawSnippet || 'Evidence captured via semantic extraction.'}"
                            </p>

                            {ev.method && (
                                <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Method: {ev.method}</p>
                            )}

                            <div className="flex flex-col gap-2 mt-2">
                                {(ev.urls || (ev.sourceUrl ? [ev.sourceUrl] : [])).map((url: string, i: number) => (
                                    <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        {new URL(url).hostname}
                                        <span className="text-gray-400 text-[10px] ml-auto">
                                            {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
