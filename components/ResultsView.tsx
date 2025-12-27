
import React, { useState } from 'react';
import { EnrichedItem, ValidationStatus } from '../types';
import { Search, Edit, FileJson, FileSpreadsheet, Loader2, X, TrendingUp } from 'lucide-react';
import StatusBadge from './StatusBadge';
import Papa from 'papaparse';

interface ResultsViewProps {
  items: EnrichedItem[];
  queue: string[];
  stats: any;
  onViewItem: (item: EnrichedItem) => void;
  onRetry: (id: string) => void;
  onCancelQueueItem: (index: number) => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ items, queue, stats, onViewItem, onRetry, onCancelQueueItem }) => {
  const [filter, setFilter] = useState<'all' | ValidationStatus>('all');
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'all' || item.status === filter;
    const matchesSearch = search === '' || 
        item.input_raw.toLowerCase().includes(search.toLowerCase()) || 
        (item.data.model && item.data.model.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleExportCSV = () => {
      const csvData = filteredItems.map(item => ({
          sku: item.data.model || 'UNKNOWN',
          brand: item.data.brand,
          short_model: item.data.short_model,
          printers: item.data.printers_ru.join('; '),
          weight: item.data.packaging_from_nix?.weight_g || 0,
          status: item.status
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `consumables_${Date.now()}.csv`);
      link.click();
  };

  const processingItem = items.find(i => i.status === 'processing');
  const progressPercent = stats.total > 0 ? Math.round(((stats.ok + stats.needs_review) / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="px-6 py-6 border-b border-slate-200 bg-white grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Total Queue</div>
              <div className="text-2xl font-black text-indigo-900">{stats.total}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Approved</div>
              <div className="text-2xl font-black text-emerald-900">{stats.ok}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
              <div className="text-[10px] font-bold text-amber-500 uppercase mb-1">Needs Review</div>
              <div className="text-2xl font-black text-amber-900">{stats.needs_review}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Batch Progress</div>
                <div className="text-2xl font-black text-slate-900">{progressPercent}%</div>
              </div>
              <TrendingUp className="text-slate-300" size={24} />
          </div>
      </div>

      <div className="px-6 py-4 bg-white/50 glass border-b border-slate-200 flex flex-col md:flex-row justify-between gap-4 z-10">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search extracted data..." 
                className="w-full md:w-80 pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
          </div>

          <div className="flex gap-2 items-center">
             <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                 {['all', 'ok', 'needs_review'].map((f) => (
                    <button 
                      key={f}
                      onClick={() => setFilter(f as any)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      {f === 'needs_review' ? 'Review' : f}
                    </button>
                 ))}
             </div>
             <div className="w-px h-6 bg-slate-200 mx-2"></div>
             <button onClick={handleExportCSV} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl"><FileSpreadsheet size={20} /></button>
          </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
          {(queue.length > 0 || processingItem) && (
            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/20 border border-indigo-100 overflow-hidden animate-pulse-subtle p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                   {processingItem && (
                      <div className="px-4 py-2 bg-indigo-600 text-white rounded-2xl flex items-center justify-between text-xs font-bold">
                         <span className="truncate pr-4">{processingItem.input_raw}</span>
                         <Loader2 size={12} className="animate-spin" />
                      </div>
                   )}
                   {queue.map((q, i) => (
                      <div key={i} className="px-4 py-2 bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl flex items-center justify-between text-xs group">
                         <span className="truncate pr-4">{q}</span>
                         <button onClick={() => onCancelQueueItem(i)} className="opacity-0 group-hover:opacity-100 text-red-400"><X size={14} /></button>
                      </div>
                   ))}
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-400">
                      <tr>
                          <th className="px-6 py-4">Title / SKU</th>
                          <th className="px-6 py-4">Short Model</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Weight</th>
                          <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-all group cursor-pointer" onClick={() => onViewItem(item)}>
                              <td className="px-6 py-5">
                                  <div className="text-sm font-bold text-slate-900 truncate">{item.data.model || item.input_raw}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{item.data.brand || 'Researching...'}</div>
                              </td>
                              <td className="px-6 py-5">
                                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                    {item.data.short_model || '--'}
                                  </span>
                              </td>
                              <td className="px-6 py-5">
                                  <StatusBadge status={item.status} step={item.current_step} />
                              </td>
                              <td className="px-6 py-5 font-mono text-xs text-slate-500">
                                  {item.data.packaging_from_nix?.weight_g ? `${item.data.packaging_from_nix.weight_g}g` : '--'}
                              </td>
                              <td className="px-6 py-5 text-right">
                                  <button className="p-2 text-slate-400 hover:text-indigo-600"><Edit size={18} /></button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default ResultsView;
