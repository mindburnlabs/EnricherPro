
import React, { useState } from 'react';
import { EnrichedItem } from '../types';
import { ExternalLink, AlertTriangle, Check, Save, ChevronLeft, Brain, Link as LinkIcon, Box, Ruler, FileText, Image as ImageIcon, HelpCircle, ShieldCheck, AlertCircle, Cpu, Layers } from 'lucide-react';

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
      className={`flex items-center gap-2 py-4 px-2 text-sm font-bold transition-all relative whitespace-nowrap ${
          activeTab === id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Icon size={16} />
      {label}
      {activeTab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full"></div>}
    </button>
  );

  const ConfidenceIndicator = ({ value, label }: { value?: number, label: string }) => {
    if (value === undefined) return null;
    const isHigh = value > 0.85;
    const isMed = value > 0.6;
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">
        <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}: {Math.round(value * 100)}%</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#f8fafc] z-[100] flex flex-col md:absolute md:z-50 h-full overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                <ChevronLeft size={24} />
            </button>
            <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900 truncate leading-tight">{item.input_raw}</h2>
                <div className="flex items-center gap-3 mt-1 overflow-x-auto no-scrollbar pb-1">
                   <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest shrink-0">Model: {editedData.model || 'N/A'}</span>
                   <ConfidenceIndicator value={item.data.confidence?.model_name} label="MPN" />
                   <ConfidenceIndicator value={item.data.confidence?.logistics} label="Logistics" />
                   <ConfidenceIndicator value={item.data.confidence?.overall} label="Overall" />
                   <ConfidenceIndicator value={item.data.confidence?.source_reliability} label="Sources" />
                   {item.quality_score && (
                     <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg shadow-sm">
                       <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                       <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Quality: {Math.round(item.quality_score * 100)}%</span>
                     </div>
                   )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="hidden sm:block px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-sm font-bold transition-all">Discard</button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
                <Save size={18} /> Approve PIM Record
            </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-slate-100 px-8 flex gap-8 flex-shrink-0 overflow-x-auto no-scrollbar">
          <TabButton id="specs" icon={Box} label="Technical Specs" />
          <TabButton id="faq" icon={HelpCircle} label="AI Support FAQ" />
          <TabButton id="evidence" icon={LinkIcon} label="Proof & Sources" />
          <TabButton id="thinking" icon={Brain} label="Thinking Engine" />
          <TabButton id="images" icon={ImageIcon} label="Visual Audit" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#f8fafc]">
          <div className="max-w-6xl mx-auto">
              
              {activeTab === 'specs' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="lg:col-span-8 space-y-8">
                         {item.validation_errors.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-6 rounded-[24px] flex gap-4">
                               <AlertCircle className="text-amber-600 shrink-0" size={24} />
                               <div>
                                  <h4 className="text-sm font-bold text-amber-900 mb-1">Attention Required</h4>
                                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
                                     {item.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
                                  </ul>
                               </div>
                            </div>
                         )}

                         <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                              <FileText size={16} className="text-indigo-400" /> Identity Extraction
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 px-1">MANUFACTURER BRAND</label>
                                    <input value={editedData.brand || ''} onChange={e => setEditedData({...editedData, brand: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 px-1">MPN (FULL MODEL)</label>
                                    <input value={editedData.model || ''} onChange={e => setEditedData({...editedData, model: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold text-indigo-600 focus:bg-white focus:border-indigo-500 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 px-1">ALIAS / SHORT MODEL</label>
                                    <input value={editedData.model_alias_short || ''} onChange={e => setEditedData({...editedData, model_alias_short: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all" placeholder="e.g. 12A or HP 27" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 px-1">YIELD & RESOURCE</label>
                                    <div className="flex gap-2">
                                        <input type="number" value={editedData.yield?.value || 0} onChange={e => setEditedData({...editedData, yield: {...(editedData.yield || {unit:'pages'}), value: parseInt(e.target.value)}})} className="w-1/2 bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500" />
                                        <select value={editedData.yield?.unit || 'pages'} className="w-1/2 bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 font-bold text-slate-700" onChange={e => setEditedData({...editedData, yield: {...(editedData.yield || {value:0}), unit: e.target.value as any}})}>
                                            <option value="pages">Pages (A4)</option>
                                            <option value="ml">Volume (ml)</option>
                                            <option value="copies">Copies</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-2">
                                    <button 
                                      onClick={() => setEditedData({...editedData, has_chip: !editedData.has_chip})}
                                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${editedData.has_chip ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                                    >
                                      <span className="text-xs font-bold flex items-center gap-2"><Cpu size={14} /> IC Chip Present</span>
                                      <div className={`w-8 h-4 rounded-full relative transition-colors ${editedData.has_chip ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editedData.has_chip ? 'left-4.5' : 'left-0.5'}`} />
                                      </div>
                                    </button>
                                    <button 
                                      onClick={() => setEditedData({...editedData, has_page_counter: !editedData.has_page_counter})}
                                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${editedData.has_page_counter ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                                    >
                                      <span className="text-xs font-bold flex items-center gap-2"><Layers size={14} /> Page Counter FW</span>
                                      <div className={`w-8 h-4 rounded-full relative transition-colors ${editedData.has_page_counter ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${editedData.has_page_counter ? 'left-4.5' : 'left-0.5'}`} />
                                      </div>
                                    </button>
                                </div>
                            </div>
                         </div>

                         <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                   <ShieldCheck size={16} className="text-emerald-500" /> Russian Market Compatibility
                                </h3>
                                <span className="text-[10px] font-bold text-slate-400">{editedData.printers_ru.length} units validated</span>
                             </div>
                             <textarea 
                                value={editedData.printers_ru.join('\n')} 
                                onChange={e => setEditedData({...editedData, printers_ru: e.target.value.split('\n')})}
                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-6 font-medium text-slate-700 focus:bg-white focus:border-indigo-500 h-64 leading-relaxed" 
                                placeholder="Paste validated RU printer models here..."
                             />
                         </div>
                      </div>

                      <div className="lg:col-span-4 space-y-6">
                         <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl shadow-slate-200">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                              <Ruler size={14} className="text-indigo-400" /> Logistics (NIX.ru Exclusive)
                              {editedData.packaging_from_nix?.confidence && (
                                <span className={`text-[8px] px-2 py-1 rounded-full ${
                                  editedData.packaging_from_nix.confidence > 0.8 ? 'bg-green-500/20 text-green-400' :
                                  editedData.packaging_from_nix.confidence > 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {Math.round(editedData.packaging_from_nix.confidence * 100)}% confidence
                                </span>
                              )}
                            </h3>
                            <div className="space-y-6">
                               <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                  <span className="text-xs font-bold text-slate-500">Gross Weight</span>
                                  <span className="text-sm font-mono text-indigo-300">{editedData.packaging_from_nix?.weight_g || 0} g</span>
                               </div>
                               <div className="grid grid-cols-3 gap-2">
                                  <div className="text-center p-3 rounded-2xl bg-slate-800 border border-slate-700">
                                     <div className="text-[9px] text-slate-500 uppercase mb-1">Width</div>
                                     <div className="text-xs font-bold">{editedData.packaging_from_nix?.width_mm || '--'}</div>
                                  </div>
                                  <div className="text-center p-3 rounded-2xl bg-slate-800 border border-slate-700">
                                     <div className="text-[9px] text-slate-500 uppercase mb-1">Height</div>
                                     <div className="text-xs font-bold">{editedData.packaging_from_nix?.height_mm || '--'}</div>
                                  </div>
                                  <div className="text-center p-3 rounded-2xl bg-slate-800 border border-slate-700">
                                     <div className="text-[9px] text-slate-500 uppercase mb-1">Depth</div>
                                     <div className="text-xs font-bold">{editedData.packaging_from_nix?.depth_mm || '--'}</div>
                                  </div>
                               </div>
                               
                               {/* Enhanced source information */}
                               {editedData.packaging_from_nix?.source_url && (
                                 <div className="text-[9px] text-slate-400 bg-white/5 p-3 rounded-xl">
                                   <div className="flex items-center gap-2 mb-2">
                                     <span className="text-green-400">✓</span>
                                     <span className="font-semibold">NIX.ru Exclusive Source</span>
                                   </div>
                                   <div className="text-slate-500">
                                     URL: <span className="font-mono">{editedData.packaging_from_nix.source_url}</span>
                                   </div>
                                   {editedData.packaging_from_nix.extraction_timestamp && (
                                     <div className="text-slate-500 mt-1">
                                       Extracted: {new Date(editedData.packaging_from_nix.extraction_timestamp).toLocaleString()}
                                     </div>
                                   )}
                                 </div>
                               )}
                               
                               {editedData.packaging_from_nix?.raw_source_string && (
                                   <div className="text-[9px] text-slate-500 italic font-mono bg-white/5 p-3 rounded-xl">
                                      Raw Data: {editedData.packaging_from_nix.raw_source_string}
                                   </div>
                               )}
                               
                               {!editedData.packaging_from_nix && (
                                  <div className="text-[10px] text-amber-400 flex items-center gap-2 bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
                                     <AlertTriangle size={12} /> NIX.ru data unavailable. Manual review required.
                                  </div>
                               )}
                               
                               {/* Validation warnings */}
                               {editedData.packaging_from_nix && editedData.packaging_from_nix.confidence && editedData.packaging_from_nix.confidence < 0.5 && (
                                 <div className="text-[10px] text-red-400 flex items-center gap-2 bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                                   <AlertTriangle size={12} /> Low confidence data. Verify dimensions manually.
                                 </div>
                               )}
                            </div>
                         </div>
                         
                         <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Related Consumables</h3>
                            <div className="space-y-4">
                               {/* Enhanced related products display */}
                               {editedData.related_consumables_display && editedData.related_consumables_display.length > 0 ? (
                                 <>
                                   {/* Categorized display */}
                                   {editedData.related_consumables_categories && (
                                     <div className="space-y-4">
                                       {/* Companions */}
                                       {editedData.related_consumables_categories.companions.length > 0 && (
                                         <div>
                                           <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Essential Companions</h4>
                                           <div className="space-y-2">
                                             {editedData.related_consumables_categories.companions.slice(0, 3).map((rel, i) => (
                                               <div key={i} className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                 <div className="min-w-0 flex-1">
                                                   <div className="text-xs font-bold text-slate-900 truncate">{rel.model}</div>
                                                   <div className="text-[9px] text-indigo-600 font-bold uppercase">{rel.type}</div>
                                                   <div className="flex items-center gap-2 mt-1">
                                                     <span className="text-[8px] text-slate-400">Priority: {rel.priority}/10</span>
                                                     <span className="text-[8px] text-slate-400">•</span>
                                                     <span className="text-[8px] text-slate-400">Confidence: {Math.round(rel.confidence * 100)}%</span>
                                                     {rel.isOEM && <span className="text-[8px] bg-green-100 text-green-700 px-1 rounded">OEM</span>}
                                                   </div>
                                                 </div>
                                                 <div className="text-right">
                                                   <span className="text-[9px] text-slate-400 font-bold block">{rel.relationship.replace(/_/g, ' ')}</span>
                                                   <span className="text-[8px] text-slate-300">{rel.sourceCount} source{rel.sourceCount !== 1 ? 's' : ''}</span>
                                                 </div>
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       )}
                                       
                                       {/* Alternatives */}
                                       {editedData.related_consumables_categories.alternatives.length > 0 && (
                                         <div>
                                           <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">Alternatives</h4>
                                           <div className="space-y-2">
                                             {editedData.related_consumables_categories.alternatives.slice(0, 3).map((rel, i) => (
                                               <div key={i} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                                 <div className="min-w-0 flex-1">
                                                   <div className="text-xs font-bold text-slate-900 truncate">{rel.model}</div>
                                                   <div className="text-[9px] text-amber-600 font-bold uppercase">{rel.type}</div>
                                                   <div className="flex items-center gap-2 mt-1">
                                                     {rel.yieldComparison && (
                                                       <span className={`text-[8px] px-1 rounded ${
                                                         rel.yieldComparison === 'higher' ? 'bg-green-100 text-green-700' :
                                                         rel.yieldComparison === 'lower' ? 'bg-red-100 text-red-700' :
                                                         'bg-gray-100 text-gray-700'
                                                       }`}>
                                                         {rel.yieldComparison} yield
                                                       </span>
                                                     )}
                                                     {rel.colorVariant && (
                                                       <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded">{rel.colorVariant}</span>
                                                     )}
                                                     <span className="text-[8px] text-slate-400">Confidence: {Math.round(rel.confidence * 100)}%</span>
                                                   </div>
                                                 </div>
                                                 <div className="text-right">
                                                   <span className="text-[9px] text-slate-400 font-bold block">{rel.relationship.replace(/_/g, ' ')}</span>
                                                   <span className="text-[8px] text-slate-300">{rel.sourceCount} source{rel.sourceCount !== 1 ? 's' : ''}</span>
                                                 </div>
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       )}
                                       
                                       {/* Color Variants */}
                                       {editedData.related_consumables_categories.colorVariants.length > 0 && (
                                         <div>
                                           <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2">Color Variants</h4>
                                           <div className="grid grid-cols-2 gap-2">
                                             {editedData.related_consumables_categories.colorVariants.slice(0, 4).map((rel, i) => (
                                               <div key={i} className="p-2 bg-purple-50/50 rounded-lg border border-purple-100">
                                                 <div className="text-xs font-bold text-slate-900 truncate">{rel.model}</div>
                                                 <div className="text-[9px] text-purple-600 font-bold">{rel.colorVariant || 'Color'}</div>
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       )}
                                     </div>
                                   )}
                                   
                                   {/* Fallback to display list if categories not available */}
                                   {!editedData.related_consumables_categories && (
                                     <div className="space-y-3">
                                       {editedData.related_consumables_display.map((rel, i) => (
                                         <div key={i} className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                           <div className="min-w-0 flex-1">
                                             <div className="text-xs font-bold text-slate-900 truncate">{rel.model}</div>
                                             <div className="text-[9px] text-indigo-600 font-bold uppercase">{rel.type}</div>
                                             <div className="flex items-center gap-2 mt-1">
                                               <span className="text-[8px] text-slate-400">Priority: {rel.priority}/10</span>
                                               <span className="text-[8px] text-slate-400">•</span>
                                               <span className="text-[8px] text-slate-400">Confidence: {Math.round(rel.confidence * 100)}%</span>
                                             </div>
                                           </div>
                                           <div className="text-right">
                                             <span className="text-[9px] text-slate-400 font-bold">{rel.relationship.replace(/_/g, ' ')}</span>
                                           </div>
                                         </div>
                                       ))}
                                     </div>
                                   )}
                                 </>
                               ) : (
                                 /* Fallback to legacy related_consumables */
                                 editedData.related_consumables && editedData.related_consumables.length > 0 ? (
                                   <div className="space-y-3">
                                     {editedData.related_consumables.map((rel, i) => (
                                       <div key={i} className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                         <div className="min-w-0">
                                           <div className="text-xs font-bold text-slate-900 truncate">{rel.model}</div>
                                           <div className="text-[9px] text-indigo-600 font-bold uppercase">{rel.type}</div>
                                         </div>
                                         <span className="text-[9px] text-slate-400 font-bold">{rel.relationship}</span>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <span className="text-xs text-slate-300 italic">No companion items identified.</span>
                                 )
                               )}
                            </div>
                         </div>
                      </div>
                  </div>
              )}

              {activeTab === 'faq' && (
                  <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
                      <div className="bg-indigo-600 rounded-[32px] p-8 text-white mb-8 shadow-lg shadow-indigo-100">
                         <h3 className="text-2xl font-black mb-2 flex items-center gap-3">
                            <HelpCircle size={28} /> AI Technical FAQ
                         </h3>
                         <p className="text-indigo-100 opacity-80">Synthesized from customer queries, forum discussions, and technical docs to assist sales and customer support.</p>
                      </div>
                      {editedData.faq.map((item, i) => (
                          <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                             <h4 className="font-black text-slate-900 mb-3 flex gap-3 text-lg">
                                <span className="text-indigo-500 shrink-0">Q.</span> {item.question}
                             </h4>
                             <p className="text-slate-600 leading-relaxed flex gap-3 text-sm">
                                <span className="text-emerald-500 font-bold shrink-0">A.</span> {item.answer}
                             </p>
                          </div>
                      ))}
                  </div>
              )}

              {activeTab === 'evidence' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Quality Metrics Overview */}
                    {item.evidence.quality_metrics && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8 rounded-[32px] border border-indigo-100">
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-indigo-600" /> Quality Metrics Dashboard
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                            <div className="text-2xl font-black text-indigo-600">{Math.round(item.evidence.quality_metrics.data_completeness_score * 100)}%</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Complete</div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                            <div className="text-2xl font-black text-emerald-600">{Math.round(item.evidence.quality_metrics.source_reliability_score * 100)}%</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source Trust</div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                            <div className="text-2xl font-black text-blue-600">{Math.round(item.evidence.quality_metrics.validation_pass_rate * 100)}%</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Validation Pass</div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                            <div className="text-2xl font-black text-purple-600">{Math.round(item.evidence.quality_metrics.processing_efficiency * 100)}%</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Efficiency</div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                            <div className="text-2xl font-black text-amber-600">{item.evidence.quality_metrics.total_sources_used}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sources Used</div>
                          </div>
                        </div>
                        {item.evidence.quality_metrics.failed_validations.length > 0 && (
                          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                            <h4 className="text-xs font-bold text-amber-900 mb-2">Failed Validations</h4>
                            <ul className="text-[10px] text-amber-700 space-y-1">
                              {item.evidence.quality_metrics.failed_validations.map((validation, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <AlertTriangle size={10} />
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
                      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          <Cpu size={16} className="text-indigo-400" /> Processing Timeline
                        </h3>
                        <div className="space-y-4">
                          {item.evidence.processing_history.map((step, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                              <div className={`w-3 h-3 rounded-full mt-1 ${
                                step.status === 'completed' ? 'bg-emerald-500' : 
                                step.status === 'failed' ? 'bg-rose-500' : 
                                step.status === 'started' ? 'bg-blue-500' : 'bg-slate-400'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-bold text-slate-900 capitalize">{step.step.replace('_', ' ')}</span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {step.duration_ms ? `${step.duration_ms}ms` : 'In progress'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600">
                                  Status: <span className={`font-bold ${
                                    step.status === 'completed' ? 'text-emerald-600' : 
                                    step.status === 'failed' ? 'text-rose-600' : 
                                    'text-blue-600'
                                  }`}>{step.status}</span>
                                </div>
                                {step.error_message && (
                                  <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg">
                                    <span className="text-xs text-rose-700">{step.error_message}</span>
                                  </div>
                                )}
                                {step.data_changes && step.data_changes.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {step.data_changes.map((change, j) => (
                                      <span key={j} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg">
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
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <LinkIcon size={16} className="text-indigo-400" /> Evidence Sources
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {item.evidence.sources.map((src, i) => (
                          <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2">
                                <div className="px-3 py-1 bg-white rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-200">
                                  {src.source_type}
                                </div>
                                {src.confidence && (
                                  <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                    src.confidence > 0.8 ? 'bg-emerald-100 text-emerald-700' :
                                    src.confidence > 0.6 ? 'bg-amber-100 text-amber-700' :
                                    'bg-rose-100 text-rose-700'
                                  }`}>
                                    {Math.round(src.confidence * 100)}% confidence
                                  </div>
                                )}
                              </div>
                              <a href={src.url} target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-700 transition-all">
                                <ExternalLink size={16} />
                              </a>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-bold text-slate-900 mb-2 text-sm">Verified Claims</h4>
                                <div className="space-y-1">
                                  {src.claims.map(claim => (
                                    <div key={claim} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                      <Check size={10} className="text-emerald-500" /> {claim.toUpperCase()}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {src.evidence_snippets_by_claim && Object.keys(src.evidence_snippets_by_claim).length > 0 && (
                                <div>
                                  <h4 className="font-bold text-slate-900 mb-2 text-sm">Evidence Snippets</h4>
                                  <div className="space-y-2">
                                    {Object.entries(src.evidence_snippets_by_claim).map(([claim, snippet]) => (
                                      <div key={claim} className="bg-white p-3 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-indigo-600 uppercase mb-1">{claim}</div>
                                        <div className="text-xs text-slate-700 font-mono leading-relaxed">{snippet}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 border-t border-slate-200">
                                <div className="flex justify-between items-center text-[10px] text-slate-400">
                                  <span>Method: {src.extraction_method || 'automated'}</span>
                                  <span>{new Date(src.extracted_at).toLocaleString()}</span>
                                </div>
                                {src.processing_duration_ms && (
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    Processing: {src.processing_duration_ms}ms
                                    {src.retry_count && src.retry_count > 0 && ` (${src.retry_count} retries)`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Audit Trail */}
                    {item.evidence.audit_trail && item.evidence.audit_trail.length > 0 && (
                      <div className="bg-slate-900 rounded-[32px] p-1 shadow-2xl overflow-hidden">
                        <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-widest">Audit_Trail.log</span>
                        </div>
                        <div className="bg-slate-900 p-6 font-mono text-xs text-emerald-300/80 leading-relaxed overflow-auto max-h-[40vh] custom-scrollbar">
                          {item.evidence.audit_trail.map((entry, i) => (
                            <div key={i} className="mb-4 pb-4 border-b border-slate-800 last:border-b-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-slate-500">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
                                <span className="text-indigo-400 font-bold">{entry.action.toUpperCase()}</span>
                                <span className="text-slate-400">@{entry.component}</span>
                              </div>
                              <div className="text-emerald-300 mb-2">{entry.details}</div>
                              {entry.data_fields_affected.length > 0 && (
                                <div className="text-slate-500 text-[10px]">
                                  Fields: {entry.data_fields_affected.join(', ')}
                                </div>
                              )}
                              {entry.confidence_impact && (
                                <div className="text-amber-400 text-[10px]">
                                  Confidence impact: {(entry.confidence_impact * 100).toFixed(1)}%
                                </div>
                              )}
                              {entry.processing_time_ms && (
                                <div className="text-blue-400 text-[10px]">
                                  Duration: {entry.processing_time_ms}ms
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search Grounding */}
                    {item.evidence.grounding_metadata && (
                      <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-4">Search Grounding Sources</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.evidence.grounding_metadata.map((g, i) => (
                            <a key={i} href={g.uri} target="_blank" rel="noreferrer" className="bg-white p-3 rounded-xl border border-indigo-200 flex items-center justify-between text-[10px] font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all">
                              <span className="truncate pr-4">{g.uri}</span>
                              <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
              )}

              {activeTab === 'thinking' && (
                  <div className="bg-slate-900 rounded-[32px] p-1 shadow-2xl overflow-hidden">
                    <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                       <span className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-widest">Thought_Process_Log.run</span>
                    </div>
                    <div className="bg-slate-900 p-8 font-mono text-xs text-indigo-300/80 leading-relaxed overflow-auto max-h-[60vh] custom-scrollbar">
                       {item.thinking_process || "// Reasoning log empty for this process."}
                    </div>
                  </div>
              )}

              {activeTab === 'images' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
                      {editedData.images.map((img, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 group relative">
                              <div className="aspect-square bg-white rounded-[24px] overflow-hidden flex items-center justify-center p-4">
                                  <img src={img.url} alt="Consumable" className="max-w-full max-h-full object-contain mix-blend-multiply" />
                              </div>
                              <div className="mt-6">
                                 <div className="flex justify-between items-center mb-4">
                                    <div>
                                       <div className="text-[10px] font-black text-slate-900 uppercase">Image Audit</div>
                                       <div className="text-[10px] font-mono text-slate-400">{img.width}x{img.height} • {Math.round(img.white_bg_score * 100)}% Background</div>
                                    </div>
                                    <div className={`p-2 rounded-xl ${img.passes_rules ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                       {img.passes_rules ? <Check size={16} /> : <AlertTriangle size={16} />}
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                       <span className="text-slate-400">RESOLUTION (800x800+)</span>
                                       <span className={img.width >= 800 && img.height >= 800 ? 'text-emerald-500' : 'text-rose-500'}>
                                          {img.width >= 800 && img.height >= 800 ? 'PASS' : 'FAIL'}
                                       </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                       <span className="text-slate-400">NO PACKAGING</span>
                                       <span className={img.is_packaging ? 'text-rose-500' : 'text-emerald-500'}>{img.is_packaging ? 'FAIL' : 'PASS'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                       <span className="text-slate-400">NO WATERMARK</span>
                                       <span className={img.has_watermark ? 'text-rose-500' : 'text-emerald-500'}>{img.has_watermark ? 'FAIL' : 'PASS'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] font-bold">
                                       <span className="text-slate-400">COMPATIBLE LOOK</span>
                                       <span className={img.has_oem_logo ? 'text-rose-500' : 'text-emerald-500'}>{img.has_oem_logo ? 'OEM LOGO' : 'OK'}</span>
                                    </div>
                                    {img.reject_reasons && img.reject_reasons.length > 0 && (
                                       <div className="mt-2 p-2 bg-rose-50 rounded-lg">
                                          <div className="text-[8px] font-bold text-rose-600 uppercase mb-1">Rejection Reasons</div>
                                          {img.reject_reasons.map((reason, idx) => (
                                             <div key={idx} className="text-[8px] text-rose-500 font-mono">{reason}</div>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                              </div>
                          </div>
                      ))}
                      <div className="aspect-square border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer">
                         <ImageIcon size={32} className="mb-2 opacity-50" />
                         <span className="text-xs font-bold uppercase tracking-wider">Manual Upload</span>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default DetailView;
