
import React, { useState } from 'react';
import { EnrichedItem } from '../types';
import { ExternalLink, AlertTriangle, Check, Save, ChevronLeft, Brain, Link as LinkIcon, Box, Ruler, FileText, Image as ImageIcon, HelpCircle, ShieldCheck, AlertCircle, Cpu, Layers, Package, Target } from 'lucide-react';

interface DetailViewProps {
  item: EnrichedItem;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<EnrichedItem>) => void;
}

const DetailView: React.FC<DetailViewProps> = ({ item, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'specs' | 'evidence' | 'thinking' | 'images' | 'faq'>('specs');
  const [editedData, setEditedData] = useState(item.data);

  const handleSave = () => {
    onUpdate(item.id, { data: editedData, status: 'ok', validation_errors: [] });
    onClose();
  };

  const TabButton = ({ id, icon: Icon, label }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === id ? 'text-primary-accent' : 'text-primary-subtle hover:text-primary'
        }`}
    >
      <Icon size={14} className={activeTab === id ? 'text-primary-accent' : 'text-primary-subtle'} />
      {label}
      {activeTab === id && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-accent shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
      )}
    </button>
  );

  const ConfidenceIndicator = ({ value, label, size = 'md' }: { value?: number, label: string, size?: 'sm' | 'md' }) => {
    if (value === undefined) return null;
    const isHigh = value > 0.85;
    const isMed = value > 0.6;
    const color = isHigh ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
      isMed ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
        'text-red-400 border-red-500/30 bg-red-500/10';

    return (
      <div className={`flex items-center gap-2 px-3 py-1 border rounded-xl ${color}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-emerald-400' : isMed ? 'bg-amber-400' : 'bg-red-400'} shadow-[0_0_6px_currentColor]`}></div>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}: {Math.round(value * 100)}%</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-background z-[100] flex flex-col h-full overflow-hidden animate-in fade-in duration-500 transition-colors">
      {/* Header */}
      <div className="h-24 border-b border-border-subtle px-8 flex items-center justify-between bg-transparent flex-shrink-0 z-10">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={onClose} className="p-3 text-primary-subtle hover:text-primary hover:bg-primary/5 rounded-2xl transition-all border border-transparent hover:border-border-subtle">
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-primary truncate leading-tight tracking-tight">{item.input_raw}</h2>
            <div className="flex items-center gap-4 mt-2 overflow-x-auto no-scrollbar pb-1">
              <div className="flex items-center gap-2 bg-primary-accent/10 border border-primary-accent/20 px-3 py-1 rounded-xl">
                <span className="text-[10px] font-black text-primary-accent uppercase tracking-widest">Model</span>
                <span className="text-sm font-bold text-primary tracking-widest font-mono">{editedData.model || 'UNIDENTIFIED'}</span>
              </div>
              <div className="h-4 w-px bg-border-subtle shrink-0"></div>
              <ConfidenceIndicator value={item.data.confidence?.overall} label="System Confidence" />
              {item.quality_score && (
                <div className="flex items-center gap-2 px-3 py-1 bg-surface border border-border-subtle rounded-xl">
                  <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">Quality Matched</span>
                  <span className="text-[10px] font-black text-primary">{Math.round(item.quality_score * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="hidden sm:block px-6 py-3 text-primary-subtle hover:text-primary text-[10px] font-black uppercase tracking-widest transition-all">Discard Changes</button>
          <button onClick={handleSave} className="premium-button px-8 py-3 bg-primary-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/40 border border-indigo-500/20 hover:bg-indigo-500 flex items-center gap-2">
            <Save size={16} /> Approve PIM Record
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-transparent border-b border-border-subtle px-8 flex gap-2 flex-shrink-0 overflow-x-auto no-scrollbar">
        <TabButton id="specs" icon={Box} label="Technical Specs" />
        <TabButton id="faq" icon={HelpCircle} label="AI Support FAQ" />
        <TabButton id="evidence" icon={LinkIcon} label="Proof & Sources" />
        <TabButton id="thinking" icon={Brain} label="Thinking Engine" />
        <TabButton id="images" icon={ImageIcon} label="Visual Audit" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-transparent custom-scrollbar">
        <div className="max-w-7xl mx-auto">

          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="lg:col-span-8 space-y-10">
                {item.validation_errors.length > 0 && (
                  <div className="bg-status-error/10 border border-status-error/20 p-6 rounded-[2rem] flex gap-4">
                    <AlertCircle className="text-status-error shrink-0" size={24} />
                    <div>
                      <h4 className="text-[10px] font-black text-status-error mb-1 uppercase tracking-widest">Structural Alert</h4>
                      <ul className="text-xs text-primary-subtle list-disc list-inside space-y-1 font-medium">
                        {item.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="glass-card p-10 rounded-[3rem] border-border-subtle relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <FileText size={120} />
                  </div>
                  <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                    <div className="p-2 bg-primary-accent/10 rounded-lg">
                      <FileText size={16} className="text-primary-accent" />
                    </div>
                    Identity Extraction
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-primary-subtle px-1 uppercase tracking-widest">Brand Authority</label>
                      <input value={editedData.brand || ''} onChange={e => setEditedData({ ...editedData, brand: e.target.value })} className="w-full bg-surface border border-border-subtle rounded-2xl p-5 font-black text-primary hover:border-primary-accent/50 focus:border-primary-accent outline-none transition-all placeholder:text-primary-subtle" />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-primary-subtle px-1 uppercase tracking-widest">Entity Identification (MPN)</label>
                      <input value={editedData.model || ''} onChange={e => setEditedData({ ...editedData, model: e.target.value })} className="w-full bg-surface border border-border-subtle rounded-2xl p-5 font-black text-primary-accent hover:border-primary-accent/50 focus:border-primary-accent outline-none transition-all placeholder:text-primary-subtle" />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-primary-subtle px-1 uppercase tracking-widest">Semantic Alias</label>
                      <input value={editedData.model_alias_short || ''} onChange={e => setEditedData({ ...editedData, model_alias_short: e.target.value })} className="w-full bg-surface border border-border-subtle rounded-2xl p-5 font-bold text-primary hover:border-primary-accent/50 focus:border-primary-accent outline-none transition-all" placeholder="short-hand identifier" />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-primary-subtle px-1 uppercase tracking-widest">Resource Matrix (Yield)</label>
                      <div className="flex gap-4">
                        <input type="number" value={editedData.yield?.value || 0} onChange={e => setEditedData({ ...editedData, yield: { ...(editedData.yield || { unit: 'pages' }), value: parseInt(e.target.value) } })} className="w-[45%] bg-surface border border-border-subtle rounded-2xl p-5 font-black text-primary focus:border-primary-accent outline-none" />
                        <select value={editedData.yield?.unit || 'pages'} className="w-[55%] bg-surface border border-border-subtle rounded-2xl p-5 font-black text-primary outline-none focus:border-primary-accent" onChange={e => setEditedData({ ...editedData, yield: { ...(editedData.yield || { value: 0 }), unit: e.target.value as any } })}>
                          <option value="pages">ISO/IEC PAGES (A4)</option>
                          <option value="ml">LIQUID VOLUME (ML)</option>
                          <option value="copies">DUPLICATION COPIES</option>
                        </select>
                      </div>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-6 pt-4">
                      <button
                        onClick={() => setEditedData({ ...editedData, has_chip: !editedData.has_chip })}
                        className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${editedData.has_chip ? 'bg-primary-accent/10 border-primary-accent/30 text-primary-accent' : 'bg-surface border-border-subtle text-primary-subtle hover:border-primary-accent/30'}`}
                      >
                        <span className="text-[10px] font-black flex items-center gap-3 uppercase tracking-widest"><Cpu size={16} className={editedData.has_chip ? 'text-primary-accent' : ''} /> IC Chip Architecture</span>
                        <div className={`w-10 h-5 rounded-full relative transition-all ${editedData.has_chip ? 'bg-primary-accent' : 'bg-border-subtle'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${editedData.has_chip ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>
                      <button
                        onClick={() => setEditedData({ ...editedData, has_page_counter: !editedData.has_page_counter })}
                        className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${editedData.has_page_counter ? 'bg-status-success/10 border-status-success/30 text-white' : 'bg-surface border-border-subtle text-primary-subtle hover:border-primary-accent/30'}`}
                      >
                        <span className="text-[10px] font-black flex items-center gap-3 uppercase tracking-widest"><Layers size={16} className={editedData.has_page_counter ? 'text-status-success' : ''} /> Logic Counter FW</span>
                        <div className={`w-10 h-5 rounded-full relative transition-all ${editedData.has_page_counter ? 'bg-status-success' : 'bg-border-subtle'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${editedData.has_page_counter ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-10 rounded-[3rem] border-border-subtle">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] flex items-center gap-3">
                      <div className="p-2 bg-status-success/10 rounded-lg">
                        <ShieldCheck size={16} className="text-status-success" />
                      </div>
                      Market Eligibility (RU)
                    </h3>
                    <div className="px-3 py-1 bg-surface border border-border-subtle rounded-xl text-[10px] font-black text-primary-subtle">
                      {editedData.printers_ru?.length || 0} AGENTS VALIDATED
                    </div>
                  </div>
                  <textarea
                    value={editedData.printers_ru?.join('\n') || ''}
                    onChange={e => setEditedData({ ...editedData, printers_ru: e.target.value.split('\n') })}
                    className="w-full bg-surface border border-border-subtle rounded-[2rem] p-8 font-mono text-primary focus:border-primary-accent outline-none h-80 leading-relaxed custom-scrollbar"
                    placeholder="Verified list of compatible terminal IDs..."
                  />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div className="glass-card rounded-[3rem] p-10 border-border-subtle relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Package size={140} className="text-primary-accent" />
                  </div>
                  <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                    <div className="p-2 bg-primary-accent/10 rounded-lg">
                      <Ruler size={14} className="text-primary-accent" />
                    </div>
                    Logistics Protocol
                    {editedData.packaging_from_nix?.confidence && (
                      <span className={`text-[8px] px-2 py-1 rounded-lg font-black uppercase tracking-widest ${editedData.packaging_from_nix.confidence > 0.8 ? 'bg-status-success/10 text-status-success border border-status-success/20' :
                        editedData.packaging_from_nix.confidence > 0.5 ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                          'bg-status-error/10 text-status-error border border-status-error/20'
                        }`}>
                        {Math.round(editedData.packaging_from_nix.confidence * 100)}% RELIABILITY
                      </span>
                    )}
                  </h3>
                  <div className="space-y-10 relative z-10">
                    <div className="flex justify-between items-center border-b border-border-subtle pb-6">
                      <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">Gross Mass</span>
                      <span className="text-xl font-black text-primary-accent font-mono tracking-widest">{editedData.packaging_from_nix?.weight_g || 0}<span className="text-xs ml-1 text-primary-subtle">G</span></span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-2xl bg-surface border border-border-subtle hover:border-primary-accent/30 transition-all">
                        <div className="text-[9px] text-primary-subtle uppercase font-black mb-2 tracking-widest">Width</div>
                        <div className="text-xs font-black text-primary font-mono">{editedData.packaging_from_nix?.width_mm || '--'}</div>
                      </div>
                      <div className="text-center p-4 rounded-2xl bg-surface border border-border-subtle hover:border-primary-accent/30 transition-all">
                        <div className="text-[9px] text-primary-subtle uppercase font-black mb-2 tracking-widest">Height</div>
                        <div className="text-xs font-black text-primary font-mono">{editedData.packaging_from_nix?.height_mm || '--'}</div>
                      </div>
                      <div className="text-center p-4 rounded-2xl bg-surface border border-border-subtle hover:border-primary-accent/30 transition-all">
                        <div className="text-[9px] text-primary-subtle uppercase font-black mb-2 tracking-widest">Depth</div>
                        <div className="text-xs font-black text-primary font-mono">{editedData.packaging_from_nix?.depth_mm || '--'}</div>
                      </div>
                    </div>

                    {/* Enhanced source information */}
                    {editedData.packaging_from_nix?.source_url && (
                      <div className="text-[10px] bg-status-success/5 p-4 rounded-2xl border border-status-success/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                          <span className="font-black text-status-success uppercase tracking-widest">NIX.ru Authority Verified</span>
                        </div>
                        <div className="text-primary-subtle font-mono text-[9px] break-all leading-relaxed">
                          {editedData.packaging_from_nix.source_url}
                        </div>
                      </div>
                    )}

                    {editedData.packaging_from_nix?.raw_source_string && (
                      <div className="text-[9px] text-primary-subtle italic font-mono bg-surface p-4 rounded-2xl border border-border-subtle max-h-24 overflow-y-auto no-scrollbar">
                        {editedData.packaging_from_nix.raw_source_string}
                      </div>
                    )}

                    {!editedData.packaging_from_nix && (
                      <div className="text-[10px] text-amber-400 flex items-center gap-3 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20 font-black uppercase tracking-widest">
                        <AlertTriangle size={14} /> Data Missing: Request Scan
                      </div>
                    )}
                  </div>
                </div>

                <div className="glass-card rounded-[3rem] p-10 border-border-subtle">
                  <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10">Cross-Entity Dynamics</h3>
                  <div className="space-y-6">
                    {editedData.related_consumables_display && editedData.related_consumables_display.length > 0 ? (
                      <div className="space-y-8">
                        {editedData.related_consumables_categories && (
                          <div className="space-y-8">
                            {/* Companions */}
                            {editedData.related_consumables_categories.companions.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-primary-accent uppercase tracking-[0.2em] mb-4">Core Companions</h4>
                                <div className="space-y-3">
                                  {editedData.related_consumables_categories.companions.slice(0, 3).map((rel, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-subtle hover:border-primary-accent/30 transition-all group">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-black text-primary group-hover:text-primary-accent transition-colors uppercase tracking-tight truncate">{rel.model}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-[9px] font-black text-primary-accent uppercase tracking-widest">{rel.type}</span>
                                          <div className="w-1 h-1 rounded-full bg-border-subtle"></div>
                                          <span className="text-[9px] font-bold text-primary-subtle uppercase tracking-widest">{Math.round(rel.confidence * 100)}% Match</span>
                                        </div>
                                      </div>
                                      <div className="text-right ml-4">
                                        <span className="text-[9px] font-black text-primary-subtle uppercase tracking-widest block mb-1">{rel.relationship.replace(/_/g, ' ')}</span>
                                        {rel.isOEM && <span className="text-[8px] bg-status-success/10 text-status-success border border-status-success/20 px-2 py-0.5 rounded-md font-black uppercase tracking-widest">OEM</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Alternatives */}
                            {editedData.related_consumables_categories.alternatives.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-status-warning uppercase tracking-[0.2em] mb-4">Functional Alternatives</h4>
                                <div className="space-y-3">
                                  {editedData.related_consumables_categories.alternatives.slice(0, 3).map((rel, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-subtle hover:border-border-highlight transition-all group">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-black text-primary group-hover:text-primary-subtle transition-colors uppercase tracking-tight truncate">{rel.model}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                          {rel.yieldComparison && (
                                            <span className={`text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border ${rel.yieldComparison === 'higher' ? 'bg-status-success/10 text-status-success border-status-success/20' :
                                              rel.yieldComparison === 'lower' ? 'bg-status-error/10 text-status-error border-status-error/20' :
                                                'bg-surface text-primary-subtle border-border-subtle'
                                              }`}>
                                              {rel.yieldComparison} Capacity
                                            </span>
                                          )}
                                          <span className="text-[9px] font-bold text-primary-subtle uppercase tracking-widest">{Math.round(rel.confidence * 100)}% Reliability</span>
                                        </div>
                                      </div>
                                      <div className="text-right ml-4">
                                        <span className="text-[9px] font-black text-primary-subtle uppercase tracking-widest block">{rel.relationship.replace(/_/g, ' ')}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!editedData.related_consumables_categories && (
                          <div className="space-y-4">
                            {editedData.related_consumables_display.map((rel, i) => (
                              <div key={i} className="flex items-center justify-between p-5 bg-card rounded-[2rem] border border-border-subtle hover:border-border-highlight transition-all">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-black text-primary hover:text-primary-accent transition-colors uppercase truncate tracking-tighter">{rel.model}</div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] font-black text-primary-accent uppercase tracking-widest">{rel.type}</span>
                                    <div className="w-1 h-1 rounded-full bg-primary-subtle"></div>
                                    <span className="text-[10px] font-bold text-primary-subtle uppercase tracking-widest">Weight: {rel.priority}</span>
                                  </div>
                                </div>
                                <div className="text-right ml-4 px-3 py-1 bg-surface rounded-xl border border-border-subtle self-start">
                                  <span className="text-[9px] font-black text-primary-subtle uppercase tracking-widest">{rel.relationship.replace(/_/g, ' ')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 border-2 border-dashed border-border-subtle rounded-[2rem] flex flex-col items-center justify-center text-center opacity-30 grayscale">
                        <Layers size={32} className="mb-4 text-primary-subtle" />
                        <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">No relational data identified</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}



          {activeTab === 'faq' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="glass-card p-10 rounded-[3rem] border-border-subtle">
                <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                  <div className="p-2 bg-primary-accent/10 rounded-lg">
                    <HelpCircle size={16} className="text-primary-accent" />
                  </div>
                  AI Reasoning FAQ
                </h3>
                <div className="space-y-6">
                  {(item.data.faq && item.data.faq.length > 0) ? (
                    item.data.faq.map((qa: any, i: number) => (
                      <div key={i} className="bg-surface rounded-2xl p-6 border border-border-subtle hover:border-primary-accent/30 transition-all">
                        <div className="flex gap-4">
                          <div className="w-6 h-6 rounded-full bg-primary-accent/20 text-primary-accent flex items-center justify-center text-[10px] font-black shrink-0">Q</div>
                          <h4 className="text-sm font-bold text-primary leading-relaxed">{qa.question}</h4>
                        </div>
                        <div className="flex gap-4 mt-4 pl-2 border-l-2 border-border-subtle ml-3">
                          <div className="pl-4">
                            <p className="text-xs text-primary-subtle leading-relaxed">{qa.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-12 opacity-50">
                      <Brain size={48} className="mx-auto text-primary-subtle mb-4" />
                      <span className="text-xs font-black text-primary-subtle uppercase tracking-widest">No Automated FAQ Generated</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Quality Metrics Overview */}
              {item.evidence.quality_metrics && (
                <div className="glass-card p-10 rounded-[3rem] border-border-subtle relative overflow-hidden">
                  <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <ShieldCheck size={16} className="text-primary-accent" />
                    </div>
                    Quality Metrics Dashboard
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="bg-surface p-6 rounded-[2rem] border border-border-subtle">
                      <div className="text-3xl font-black text-primary-accent shadow-indigo-500/20 drop-shadow-lg">{Math.round(item.evidence.quality_metrics.data_completeness_score * 100)}%</div>
                      <div className="text-[9px] font-black text-primary-subtle uppercase tracking-widest mt-2">Data Complete</div>
                    </div>
                    <div className="bg-surface p-6 rounded-[2rem] border border-border-subtle">
                      <div className="text-3xl font-black text-emerald-400 shadow-emerald-500/20 drop-shadow-lg">{Math.round(item.evidence.quality_metrics.source_reliability_score * 100)}%</div>
                      <div className="text-[9px] font-black text-primary-subtle uppercase tracking-widest mt-2">Source Trust</div>
                    </div>
                    <div className="bg-surface p-6 rounded-[2rem] border border-border-subtle">
                      <div className="text-3xl font-black text-blue-400 shadow-blue-500/20 drop-shadow-lg">{Math.round(item.evidence.quality_metrics.validation_pass_rate * 100)}%</div>
                      <div className="text-[9px] font-black text-primary-subtle uppercase tracking-widest mt-2">Validation Pass</div>
                    </div>
                    <div className="bg-surface p-6 rounded-[2rem] border border-border-subtle">
                      <div className="text-3xl font-black text-purple-400 shadow-purple-500/20 drop-shadow-lg">{Math.round(item.evidence.quality_metrics.processing_efficiency * 100)}%</div>
                      <div className="text-[9px] font-black text-primary-subtle uppercase tracking-widest mt-2">Efficiency</div>
                    </div>
                    <div className="bg-surface p-6 rounded-[2rem] border border-border-subtle">
                      <div className="text-3xl font-black text-amber-400 shadow-amber-500/20 drop-shadow-lg">{item.evidence.quality_metrics.total_sources_used}</div>
                      <div className="text-[9px] font-black text-primary-subtle uppercase tracking-widest mt-2">Sources Used</div>
                    </div>
                  </div>
                  {item.evidence.quality_metrics.failed_validations?.length > 0 && (
                    <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4">Failed Validations</h4>
                      <ul className="text-[10px] text-primary-subtle space-y-2 font-mono">
                        {item.evidence.quality_metrics.failed_validations.map((validation, i) => (
                          <li key={i} className="flex items-center gap-3">
                            <AlertTriangle size={12} className="text-red-500" />
                            {validation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Processing History Timeline */}
              {item.evidence.processing_history && item.evidence.processing_history.length > 0 && (
                <div className="glass-card p-10 rounded-[3rem] border-border-subtle">
                  <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <Cpu size={16} className="text-primary-accent" />
                    </div>
                    Processing Timeline
                  </h3>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 before:w-px before:bg-border-subtle">
                    {item.evidence.processing_history.map((step, i) => (
                      <div key={i} className="flex items-start gap-6 relative">
                        <div className={`w-3 h-3 rounded-full mt-2 ring-4 ring-background z-10 ${step.status === 'completed' ? 'bg-status-success shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                          step.status === 'failed' ? 'bg-status-error shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                            step.status === 'started' ? 'bg-status-info animate-pulse' : 'bg-border-subtle'
                          }`}></div>
                        <div className="flex-1 min-w-0 bg-surface p-6 rounded-2xl border border-border-subtle hover:border-primary-accent/30 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-primary capitalize tracking-wide">{step.step.replace('_', ' ')}</span>
                            <span className="text-[9px] font-mono text-primary-subtle">
                              {step.duration_ms ? `${step.duration_ms}ms` : 'In progress'}
                            </span>
                          </div>
                          <div className="text-[10px] text-primary-subtle mb-2">
                            Status: <span className={`font-black tracking-widest uppercase ${step.status === 'completed' ? 'text-emerald-400' :
                              step.status === 'failed' ? 'text-status-error' :
                                'text-status-info'
                              }`}>{step.status}</span>
                          </div>
                          {step.error_message && (
                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                              <span className="text-[10px] text-red-300 font-mono">{step.error_message}</span>
                            </div>
                          )}
                          {step.data_changes && step.data_changes.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {step.data_changes.map((change, j) => (
                                <span key={j} className="px-3 py-1 bg-primary-accent/10 text-primary-accent text-[8px] font-black rounded-lg border border-primary-accent/20 uppercase tracking-wider">
                                  {change}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Sources */}
              <div className="glass-card p-10 rounded-[3rem] border-border-subtle">
                <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <LinkIcon size={16} className="text-primary-accent" />
                  </div>
                  Evidence Sources
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {item.evidence.sources.map((src, i) => (
                    <div key={i} className="bg-surface p-8 rounded-[2rem] border border-border-subtle hover:border-primary-accent/30 transition-all group">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1 bg-background rounded-lg text-[9px] font-black uppercase tracking-widest text-primary-subtle border border-border-subtle group-hover:bg-primary-accent/10 group-hover:text-primary-accent transition-colors">
                            {src.source_type}
                          </div>
                          {src.confidence && (
                            <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${src.confidence > 0.8 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              src.confidence > 0.6 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                              {Math.round(src.confidence * 100)}% Match
                            </div>
                          )}
                        </div>
                        <a href={src.url} target="_blank" rel="noreferrer" className="text-primary-subtle hover:text-white transition-all p-2 hover:bg-white/10 rounded-full">
                          <ExternalLink size={14} />
                        </a>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-black text-primary-subtle mb-2 text-[9px] uppercase tracking-widest">Verified Claims</h4>
                          <div className="flex flex-wrap gap-2">
                            {src.claims.map(claim => (
                              <div key={claim} className="flex items-center gap-2 text-[10px] font-bold text-primary bg-surface px-2 py-1 rounded-lg border border-border-subtle">
                                <Check size={10} className="text-emerald-400" /> {claim.toUpperCase()}
                              </div>
                            ))}
                          </div>
                        </div>

                        {src.evidence_snippets_by_claim && Object.keys(src.evidence_snippets_by_claim).length > 0 && (
                          <div>
                            <h4 className="font-black text-primary-subtle mb-2 text-[9px] uppercase tracking-widest">Evidence Snippets</h4>
                            <div className="space-y-2">
                              {Object.entries(src.evidence_snippets_by_claim).map(([claim, snippet]) => (
                                <div key={claim} className="bg-background p-4 rounded-xl border border-border-subtle">
                                  <div className="text-[9px] font-black text-primary-accent uppercase mb-1 tracking-wider">{claim}</div>
                                  <div className="text-[10px] text-primary-subtle font-mono leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">{snippet}</div> // Cast to string if needed
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-border-subtle">
                          <div className="flex justify-between items-center text-[9px] text-primary-subtle font-mono uppercase tracking-widest">
                            <span>Method: {src.extraction_method || 'automated'}</span>
                            <span>{new Date(src.extracted_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Trail */}
              {item.evidence.audit_trail && item.evidence.audit_trail.length > 0 && (
                <div className="bg-surface rounded-[2rem] p-1 shadow-2xl border border-border-subtle overflow-hidden">
                  <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-background/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-status-success shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                      <span className="text-[10px] font-mono text-primary-subtle uppercase font-bold tracking-widest">Audit_Trail.log</span>
                    </div>
                    <div className="text-[9px] font-mono text-primary-subtle uppercase tracking-widest">Read Only</div>
                  </div>
                  <div className="bg-background p-8 font-mono text-xs text-status-success/80 leading-relaxed overflow-auto max-h-[40vh] custom-scrollbar">
                    {item.evidence.audit_trail.map((entry, i) => (
                      <div key={i} className="mb-4 pb-4 border-b border-white/5 last:border-b-0 last:pb-0 last:mb-0">
                        <div className="flex items-center gap-3 mb-2 opacity-70">
                          <span className="text-primary-subtle">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
                          <span className="text-primary-accent font-bold tracking-wider">{entry.action.toUpperCase()}</span>
                          <span className="text-primary-subtle">@{entry.component}</span>
                        </div>
                        <div className="text-emerald-300 mb-2 pl-4 border-l border-emerald-500/20">{entry.details}</div>
                        {entry.data_fields_affected.length > 0 && (
                          <div className="text-primary-subtle text-[10px] pl-4">
                            Fields: <span className="text-primary-subtle/70">{entry.data_fields_affected.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Field-Level Traceability (New) */}
              {item.data._evidence && Object.keys(item.data._evidence).length > 0 && (
                <div className="glass-card p-10 rounded-[3rem] border-border-subtle">
                  <h3 className="text-[10px] font-black text-primary-subtle uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <Target size={16} className="text-primary-accent" />
                    </div>
                    Field-Level Traceability
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(item.data._evidence).map(([field, evidence]: [string, any]) => evidence && (
                      <div key={field} className="bg-surface p-6 rounded-2xl border border-border-subtle hover:border-primary-accent/30 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[9px] font-black text-primary-subtle uppercase tracking-widest">{field.replace(/_/g, ' ')}</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border ${evidence.confidence > 0.8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            evidence.confidence > 0.6 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>{Math.round(evidence.confidence * 100)}%</span>
                        </div>
                        <div className="font-mono text-xs text-primary font-bold mb-3 truncate" title={String(evidence.value)}>
                          {typeof evidence.value === 'object' ? JSON.stringify(evidence.value) : String(evidence.value)}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[9px] text-primary-subtle">
                            <span className="uppercase font-bold">Method:</span> {evidence.extraction_method}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {evidence.urls && evidence.urls.slice(0, 2).map((url: string, idx: number) => (
                              <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[8px] bg-background px-2 py-1 rounded-lg border border-border-subtle hover:border-primary-accent/30 hover:text-primary-accent transition-colors truncate max-w-full">
                                <LinkIcon size={8} /> {new URL(url).hostname}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Grounding */}
              {item.evidence.grounding_metadata && (
                <div className="glass-card p-10 rounded-[3rem] border-border-subtle">
                  <h4 className="text-[10px] font-black text-primary-accent uppercase tracking-[0.3em] mb-6">Search Grounding Sources</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {item.evidence.grounding_metadata.map((g, i) => (
                      <a key={i} href={g.uri} target="_blank" rel="noreferrer" className="bg-surface p-4 rounded-xl border border-border-subtle flex items-center justify-between text-[10px] font-bold text-primary-subtle hover:bg-primary-accent/10 hover:text-primary-accent hover:border-primary-accent/30 transition-all group">
                        <span className="truncate pr-4 font-mono">{g.uri}</span>
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'thinking' && (
            <div className="bg-surface rounded-[2rem] p-1 shadow-2xl border border-border-subtle overflow-hidden font-mono animate-in fade-in zoom-in-95 duration-300">
              <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-background">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-accent shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></div>
                  <span className="text-[10px] font-mono text-primary-subtle uppercase font-bold tracking-widest">Thought_Process_Log.run</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-border-subtle"></div>
                  <div className="w-2 h-2 rounded-full bg-border-subtle"></div>
                </div>
              </div>
              <div className="bg-background p-10 font-mono text-xs text-primary-accent/80 leading-relaxed overflow-auto max-h-[70vh] custom-scrollbar selection:bg-primary-accent/30 selection:text-white">
                {item.thinking_process || "// Reasoning log empty for this process."}
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
              {editedData.images.map((img, idx) => (
                <div key={idx} className="glass-card p-6 rounded-[32px] border-border-subtle group relative hover:bg-surface/50 transition-all">
                  <div className="aspect-square bg-background rounded-[24px] overflow-hidden flex items-center justify-center p-4 border border-border-subtle relative">
                    <img src={img.url} alt="Consumable" className="max-w-full max-h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                      <button className="p-3 bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-md transition-all"><ExternalLink size={20} /></button>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest drop-shadow-md">Image Audit</div>
                        <div className="text-[9px] font-mono text-primary-subtle/80 mt-1 drop-shadow-md">{img.width}x{img.height} • {Math.round(img.white_bg_score * 100)}% BG</div>
                      </div>
                      <div className={`p-2 rounded-xl border ${img.passes_rules ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {img.passes_rules ? <Check size={16} /> : <AlertTriangle size={16} />}
                      </div>
                    </div>
                    <div className="space-y-2 bg-background p-4 rounded-2xl border border-border-subtle">
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-primary-subtle">RESOLUTION (800x800+)</span>
                        <span className={img.width >= 800 && img.height >= 800 ? 'text-emerald-400' : 'text-red-400 font-black'}>
                          {img.width >= 800 && img.height >= 800 ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-primary-subtle">NO PACKAGING</span>
                        <span className={!img.is_packaging ? 'text-emerald-400' : 'text-red-400 font-black'}>{img.is_packaging ? 'FAIL' : 'PASS'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-primary-subtle">NO WATERMARK</span>
                        <span className={!img.has_watermark ? 'text-emerald-400' : 'text-red-400 font-black'}>{img.has_watermark ? 'FAIL' : 'PASS'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-primary-subtle">COMPATIBLE LOOK</span>
                        <span className={!img.has_oem_logo ? 'text-emerald-400' : 'text-amber-400'}>{img.has_oem_logo ? 'OEM LOGO' : 'OK'}</span>
                      </div>
                      {img.reject_reasons && img.reject_reasons.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border-subtle">
                          <div className="text-[8px] font-black text-red-400 uppercase mb-1 tracking-widest">Rejection Reasons</div>
                          {img.reject_reasons.map((reason, idx) => (
                            <div key={idx} className="text-[9px] text-red-300/80 font-mono flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-red-400"></div> {reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="aspect-[3/4] border-2 border-dashed border-border-subtle rounded-[32px] flex flex-col items-center justify-center text-primary-subtle hover:border-primary-accent/50 hover:text-primary-accent transition-all cursor-pointer hover:bg-surface gap-4 group">
                <div className="p-4 bg-surface rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <ImageIcon size={32} className="opacity-50 group-hover:opacity-100" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-center px-8">Upload Manual Evidence</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailView;
