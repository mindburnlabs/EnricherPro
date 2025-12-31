
import React, { useState } from 'react';
import { X, Check, AlertTriangle, ShieldCheck, Users, Globe } from 'lucide-react';
import { EnrichedItem, FieldEvidence } from '../../types/domain.js';
import { CitationDrawer } from './CitationDrawer.js';
import { EvidenceTooltip } from './EvidenceTooltip.js';

interface ItemDetailProps {
    item: EnrichedItem | null;
    open: boolean;
    onClose: () => void;
    onApprove: (id: string) => void;
}

import { useTranslation } from 'react-i18next';

// Trust Badge Component
const TrustBadge = ({ evidence }: { evidence?: FieldEvidence<any> }) => {
    const { t } = useTranslation('detail');
    if (!evidence) return null;

    if (evidence.method === 'official') {
        return <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800"><ShieldCheck className="w-3 h-3" /> {t('trust.official')}</span>;
    }
    if (evidence.method === 'agent_result' || evidence.source_url?.includes('agent-session')) {
        // Firecrawl Agent - High Trust
        return <span className="flex items-center gap-1 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800"><Users className="w-3 h-3" /> AI Agent</span>;
    }
    if (evidence.method === 'consensus') {
        return <span className="flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"><Users className="w-3 h-3" /> {t('trust.consensus')}</span>;
    }
    if (evidence.source_url?.includes('nix.ru') || evidence.source_url?.includes('dns-shop.ru')) {
        return <span className="flex items-center gap-1 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800"><ShieldCheck className="w-3 h-3" /> Verified by NIX</span>;
    }
    if (evidence.is_conflict) {
        return <span className="flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800"><AlertTriangle className="w-3 h-3" /> {t('trust.conflict')}</span>;
    }
    return <span className="flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded"><Globe className="w-3 h-3" /> {t('trust.web')}</span>;
};

export const ItemDetail: React.FC<ItemDetailProps> = ({ item, open, onClose, onApprove }) => {
    const { t } = useTranslation('detail');
    const [citationField, setCitationField] = useState<string | null>(null);

    if (!open || !item) return null;

    const { data } = item;
    const evidence = data._evidence || {};

    const openCitations = (field: string) => {
        setCitationField(field);
    };

    // Helper to render a row
    const EvidenceRow = ({ label, value, fieldEnv, fieldKey }: { label: string, value: any, fieldEnv: any, fieldKey: string }) => (
        <div
            onClick={() => openCitations(fieldKey)}
            className={`flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border cursor-pointer transition-colors group ${fieldEnv?.is_conflict ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-500'}`}
        >
            <span className="text-sm font-medium text-gray-500 capitalize">{label}</span>
            <div className="flex items-center gap-2">
                <TrustBadge evidence={fieldEnv} />
                <span className="text-sm text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap text-right max-w-[200px]">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                </span>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-gray-900 sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {data.mpn_identity.mpn || t('identity.mpn')}
                        </h2>
                        <p className="text-gray-500">{data.mpn_identity.canonical_model_name}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onApprove(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <Check className="w-4 h-4" /> {t('header.approve')}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Images Grid */}
                    {data.images && data.images.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {data.images.slice(0, 4).map((img, idx) => (
                                <div key={idx} className="aspect-square bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group">
                                    <img src={img.url} alt="Product" className="w-full h-full object-contain p-2" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Identity Section */}
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('identity.title')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EvidenceRow label={t('identity.brand')} value={data.brand} fieldEnv={evidence['brand']} fieldKey="brand" />
                            <EvidenceRow label={t('identity.mpn')} value={data.mpn_identity.mpn} fieldEnv={evidence['mpn_identity.mpn']} fieldKey="mpn_identity.mpn" />
                            <EvidenceRow label={t('specs.yield')} value={`${data.yield?.value} ${data.yield?.unit}`} fieldEnv={evidence['specifications.yield_pages']} fieldKey="specifications.yield_pages" />
                            <EvidenceRow label={t('specs.color')} value={data.color} fieldEnv={evidence['specifications.color']} fieldKey="specifications.color" />
                            {data.aliases && data.aliases.length > 0 && (
                                <EvidenceRow label="Aliases" value={data.aliases.join(", ")} fieldEnv={evidence['aliases']} fieldKey="aliases" />
                            )}
                        </div>
                    </div>

                    {/* Compatibility (RU) */}
                    {data.compatible_printers_ru && data.compatible_printers_ru.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                                Compatibility <span className="text-xs font-normal text-gray-500">(RU Region)</span>
                                {data.compatible_printers_ru.some(p => p.canonicalName?.includes('nix')) && (
                                    <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded-full">NIX Checked</span>
                                )}
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
                                <div className="flex flex-wrap gap-2">
                                    {data.compatible_printers_ru.map((p, i) => (
                                        <span key={i} className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-sm">
                                            {p.model}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FAQ Section */}
                    {data.faq && data.faq.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">FAQ & Troubleshooting</h3>
                            <div className="space-y-3">
                                {data.faq.map((item, idx) => (
                                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{item.question}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.answer}</p>
                                        {item.source_url && (
                                            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-2 block truncate">
                                                Source: {new URL(item.source_url).hostname}
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Related SKUs */}
                    {data.related_skus && data.related_skus.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Related Products</h3>
                            <div className="flex flex-wrap gap-2">
                                {data.related_skus.map((sku, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-100 dark:border-blue-800">
                                        {sku}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Logistics Section */}
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('logistics.title')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EvidenceRow label={t('logistics.weight')} value={data.packaging_from_nix?.weight_g ? `${data.packaging_from_nix.weight_g} g` : '-'} fieldEnv={evidence['packaging.weight_g']} fieldKey="packaging.weight_g" />
                            <EvidenceRow label={t('logistics.dims')} value={data.packaging_from_nix?.width_mm ? `${data.packaging_from_nix.width_mm}x${data.packaging_from_nix.height_mm}x${data.packaging_from_nix.depth_mm} mm` : '-'} fieldEnv={evidence['packaging.dimensions']} fieldKey="packaging.dimensions" />
                        </div>
                    </div>

                    {/* Conflicts Alert */}
                    {Object.values(evidence).some((e: any) => e.is_conflict) && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-amber-900 dark:text-amber-100">Conflicts Detected</h4>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                    Some fields have conflicting data from different sources. Review the highlighted fields above.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <CitationDrawer
                isOpen={!!citationField}
                onClose={() => setCitationField(null)}
                fieldLabel={citationField || ''}
                evidence={citationField ? evidence[citationField] : []}
            />
        </div>
    );
};
