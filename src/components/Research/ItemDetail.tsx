
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
    const { t } = useTranslation(['detail', 'common']);
    if (!evidence) return null;

    if (evidence.method === 'official') {
        return <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800"><ShieldCheck className="w-3 h-3" /> {t('trust.official')}</span>;
    }
    if (evidence.method === 'agent_result' || evidence.source_url?.includes('agent-session')) {
        // Firecrawl Agent - High Trust
        return <span className="flex items-center gap-1 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800"><Users className="w-3 h-3" /> {t('common:engines.firecrawl_agent')}</span>;
    }
    if (evidence.method === 'consensus') {
        return <span className="flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"><Users className="w-3 h-3" /> {t('trust.consensus')}</span>;
    }
    if (evidence.source_url?.includes('nix.ru') || evidence.source_url?.includes('dns-shop.ru')) {
        return <span className="flex items-center gap-1 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800"><ShieldCheck className="w-3 h-3" /> {t('compatibility.nix_verified')}</span>;
    }
    if (evidence.is_conflict) {
        return <span className="flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800"><AlertTriangle className="w-3 h-3" /> {t('trust.conflict')}</span>;
    }
    return <span className="flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded"><Globe className="w-3 h-3" /> {t('trust.web')}</span>;
};

export const ItemDetail: React.FC<ItemDetailProps> = ({ item, open, onClose, onApprove }) => {
    const { t } = useTranslation(['detail', 'common']);
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
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <TrustBadge evidence={fieldEnv} />
                <span className="text-sm text-gray-900 dark:text-gray-100 font-medium whitespace-pre-wrap text-right flex-1 break-words">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value || t('common:general.n_a'))}
                </span>
            </div>
        </div>
    );

    const formatBool = (val?: boolean | null) => val === true ? t('common:general.yes') : val === false ? t('common:general.no') : t('common:general.unknown');


    return (
        <div className="h-full w-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl z-40 relative">

            {/* Header */}
            <div className="flex-none p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-gray-900">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {data.mpn_identity.mpn || t('identity.mpn')}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">{data.mpn_identity.canonical_model_name}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Sticky Action Bar */}
            <div className="flex-none p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex justify-end">
                <button
                    onClick={() => onApprove(item.id)}
                    disabled={(item.status as any) === 'published'}
                    className={`px-6 py-2 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 ${(item.status as any) === 'published'
                        ? 'bg-emerald-100 text-emerald-700 shadow-none cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 active:scale-95'
                        }`}
                >
                    <Check className="w-4 h-4" /> {(item.status as any) === 'published' ? t('header.approved', 'Approved') : t('header.approve')}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                {/* Images Grid with Error Handling */}
                {data.images && data.images.filter(img => img.url).length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                        {data.images.slice(0, 4).map((img, idx) => (
                            <div key={idx} className="aspect-square bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group">
                                <img
                                    src={img.url}
                                    alt={t('images.alt')}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain p-2 hover:scale-105 transition-transform"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).parentElement!.classList.add('hidden');
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Identity Section */}
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                        {t('identity.title')}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        <EvidenceRow
                            label={t('identity.brand')}
                            value={data.brand || t('common:general.unknown')}
                            fieldEnv={evidence['brand']}
                            fieldKey="brand"
                        />
                        <EvidenceRow
                            label={t('specs.type')}
                            value={data.consumable_type ? data.consumable_type.replace('_', ' ') : t('common:general.n_a')}
                            fieldEnv={evidence['consumable_type']}
                            fieldKey="consumable_type"
                        />
                        <EvidenceRow
                            label={t('identity.mpn')}
                            value={data.mpn_identity.mpn}
                            fieldEnv={evidence['mpn_identity.mpn']}
                            fieldKey="mpn_identity.mpn"
                        />
                        {data.short_model && (
                            <EvidenceRow
                                label={t('identity.short_model')}
                                value={data.short_model}
                                fieldEnv={evidence['short_model']}
                                fieldKey="short_model"
                            />
                        )}
                        <EvidenceRow
                            label={t('specs.yield')}
                            value={data.yield && data.yield.value ? `${data.yield.value} ${data.yield.unit || ''}`.trim() : t('common:general.n_a')}
                            fieldEnv={evidence['yield.value']} // Updated Key
                            fieldKey="yield.value"
                        />
                        <EvidenceRow
                            label={t('specs.color')}
                            value={data.color}
                            fieldEnv={evidence['color']} // Updated Key (was specifications.color)
                            fieldKey="color"
                        />
                        {data.aliases && data.aliases.length > 0 && (
                            <EvidenceRow
                                label={t('identity.aliases')}
                                value={data.aliases.join(", ")}
                                fieldEnv={evidence['aliases']}
                                fieldKey="aliases"
                            />
                        )}
                    </div>
                </div>

                {/* Technical Architecture */}
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                        {t('specs.tech_title')}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        <EvidenceRow
                            label={t('specs.chip')}
                            value={formatBool(data.has_chip)}
                            fieldEnv={evidence['has_chip']}
                            fieldKey="has_chip"
                        />
                        <EvidenceRow
                            label={t('specs.counter')}
                            value={formatBool(data.has_page_counter)}
                            fieldEnv={evidence['has_page_counter']}
                            fieldKey="has_page_counter"
                        />
                        {data.gtin && data.gtin.length > 0 && (
                            <EvidenceRow
                                label={t('specs.gtin')}
                                value={data.gtin.join(", ")}
                                fieldEnv={evidence['gtin']}
                                fieldKey="gtin"
                            />
                        )}
                    </div>
                </div>

                {/* Marketing Content (SEO) */}
                {data.marketing && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800/50">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                            {t('marketing.title', 'Marketing Strategy')}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('marketing.seo_title', 'SEO Title')}</label>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-indigo-200 dark:border-indigo-800 pb-2">
                                    {data.marketing.seo_title || '-'}
                                </div>
                            </div>

                            {data.marketing.description && (
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('marketing.desc', 'Description')}</label>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none mt-1" dangerouslySetInnerHTML={{ __html: data.marketing.description }} />
                                </div>
                            )}

                            {data.marketing.feature_bullets && data.marketing.feature_bullets.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('marketing.bullets', 'Key Features')}</label>
                                    <ul className="list-disc pl-4 mt-1 space-y-1">
                                        {data.marketing.feature_bullets.map((bullet, i) => (
                                            <li key={i} className="text-xs text-gray-700 dark:text-gray-300">{bullet}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Connectivity (If present) */}
                {data.connectivity && (
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-cyan-500 rounded-full"></span>
                            {t('connectivity.title')}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {data.connectivity.ports && data.connectivity.ports.length > 0 && (
                                <EvidenceRow
                                    label={t('connectivity.ports')}
                                    value={data.connectivity.ports.join(", ")}
                                    fieldEnv={evidence['connectivity.ports']}
                                    fieldKey="connectivity.ports"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Compatibility (RU) */}
                {data.compatible_printers_ru && data.compatible_printers_ru.length > 0 && (
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                            {t('compatibility.title')} <span className="text-xs font-normal text-gray-500">{t('compatibility.region_hint')}</span>
                            {data.compatible_printers_ru.some(p => p.canonicalName?.includes('nix')) && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded-full">
                                    {t('compatibility.nix_verified')}
                                </span>
                            )}
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
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
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                            {t('faq')}
                        </h3>
                        <div className="space-y-3">
                            {data.faq.map((item, idx) => (
                                <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{item.question}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.answer}</p>
                                    {item.source_url && (
                                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-2 block truncate">
                                            {t('common:general.source')}: {new URL(item.source_url).hostname}
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Related SKUs (Enhanced) */}
                {(data.related_ids || (data.related_skus && data.related_skus.length > 0)) && (
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('related_products')}</h3>
                        <div className="flex flex-wrap gap-2">
                            {/* Prefer Structured related_ids if available, else standard string array */}
                            {data.related_ids ? data.related_ids.map((item, i) => (
                                <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-100 dark:border-blue-800 flex items-center gap-2">
                                    <span className="font-bold">{item.id}</span>
                                    <span className="text-xs opacity-70">{item.type}</span>
                                </span>
                            )) : data.related_skus!.map((sku, i) => (
                                <span key={i} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-100 dark:border-blue-800">
                                    {sku}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Logistics Section */}
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                        {t('logistics.title')}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        <EvidenceRow
                            label={t('logistics.weight')}
                            value={data.logistics?.package_weight_g ? `${data.logistics.package_weight_g} g` : (data.weight_g ? `${data.weight_g} g` : t('common:general.n_a'))}
                            fieldEnv={evidence['logistics.package_weight_g'] || evidence['weight_g']}
                            fieldKey="logistics.package_weight_g"
                        />
                        <EvidenceRow
                            label={t('logistics.dims')}
                            value={data.logistics?.width_mm ? `${data.logistics.width_mm}x${data.logistics.height_mm}x${data.logistics.depth_mm} mm` : t('common:general.n_a')}
                            fieldEnv={evidence['logistics.width_mm']}
                            fieldKey="logistics.width_mm"
                        />
                        <EvidenceRow
                            label={t('logistics.origin')}
                            value={data.logistics?.origin_country || t('common:general.n_a')}
                            fieldEnv={evidence['logistics.origin_country']}
                            fieldKey="logistics.origin_country"
                        />
                    </div>
                </div>

                {/* Compliance (RU) */}
                {(data.compliance_ru || (data as any).compliance) && (
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-4 bg-red-500 rounded-full"></span>
                            {t('compliance.title', 'Compliance & Regulation')}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            <EvidenceRow
                                label={t('compliance.tn_ved', 'TN VED Code')}
                                value={data.compliance_ru?.tn_ved_code || t('common:general.n_a')}
                                fieldEnv={evidence['compliance_ru.tn_ved_code']}
                                fieldKey="compliance_ru.tn_ved_code"
                            />
                            <EvidenceRow
                                label={t('compliance.marking', 'Mandatory Marking')}
                                value={formatBool(data.compliance_ru?.mandatory_marking)}
                                fieldEnv={evidence['compliance_ru.mandatory_marking']}
                                fieldKey="compliance_ru.mandatory_marking"
                            />
                        </div>
                    </div>
                )}

                {/* Conflicts Alert */}
                {Object.values(evidence).some((e: any) => e.is_conflict) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-amber-900 dark:text-amber-100">{t('conflicts')}</h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                {t('conflicts_desc', 'Some fields have conflicting data from different sources. Review the highlighted fields above.')}
                            </p>
                        </div>
                    </div>
                )}

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
