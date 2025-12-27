
import React, { useState, useMemo } from 'react';
import { EnrichedItem, ValidationStatus, ProcessingStats, BatchProcessingProgress, ManualQueueEntry } from '../types';
import { Search, Edit, FileJson, FileSpreadsheet, Loader2, X, TrendingUp, AlertTriangle, RefreshCw, Clock, Users, Filter, SortAsc, SortDesc, Eye, EyeOff, Zap, Target } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ConfidenceIndicator from './ConfidenceIndicator';
import Papa from 'papaparse';

interface ResultsViewProps {
  items: EnrichedItem[];
  queue: string[];
  stats: ProcessingStats;
  onViewItem: (item: EnrichedItem) => void;
  onRetry: (id: string) => void;
  onCancelQueueItem: (index: number) => void;
  batchProgress?: BatchProcessingProgress | null;
  manualQueue: ManualQueueEntry[];
  onRemoveFromManualQueue: (itemId: string) => void;
  onBulkRetry: (itemIds: string[]) => void;
  errorSummary: {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    retryableErrors: number;
    criticalErrors: number;
  };
}

const ResultsView: React.FC<ResultsViewProps> = ({ 
  items, 
  queue, 
  stats, 
  onViewItem, 
  onRetry, 
  onCancelQueueItem,
  batchProgress,
  manualQueue,
  onRemoveFromManualQueue,
  onBulkRetry,
  errorSummary
}) => {
  const [filter, setFilter] = useState<'all' | ValidationStatus>('all');
  const [search, setSearch] = useState('');
  const [showManualQueue, setShowManualQueue] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'created_at' | 'quality_score' | 'processing_time' | 'error_count'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all');

  // Enhanced filtering and sorting logic
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      const matchesFilter = filter === 'all' || item.status === filter;
      const matchesSearch = search === '' || 
          item.input_raw.toLowerCase().includes(search.toLowerCase()) || 
          (item.data.model && item.data.model.toLowerCase().includes(search.toLowerCase())) ||
          (item.data.brand && item.data.brand.toLowerCase().includes(search.toLowerCase()));
      
      // Confidence filter
      const matchesConfidence = confidenceFilter === 'all' || (() => {
        const confidence = item.data.confidence?.overall || 0;
        switch (confidenceFilter) {
          case 'high': return confidence > 0.8;
          case 'medium': return confidence > 0.5 && confidence <= 0.8;
          case 'low': return confidence <= 0.5;
          default: return true;
        }
      })();
      
      // Brand filter
      const matchesBrand = brandFilter === 'all' || item.data.brand === brandFilter;
      
      // Error type filter
      const matchesErrorType = errorTypeFilter === 'all' || 
        item.error_details?.some(error => error.category === errorTypeFilter);
      
      return matchesFilter && matchesSearch && matchesConfidence && matchesBrand && matchesErrorType;
    });

    // Sort items
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'quality_score':
          aValue = a.quality_score || 0;
          bValue = b.quality_score || 0;
          break;
        case 'processing_time':
          aValue = a.processing_duration_ms || 0;
          bValue = b.processing_duration_ms || 0;
          break;
        case 'error_count':
          aValue = a.error_details?.length || 0;
          bValue = b.error_details?.length || 0;
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [items, filter, search, sortBy, sortOrder, confidenceFilter, brandFilter, errorTypeFilter]);

  // Get unique brands for filter dropdown
  const uniqueBrands = useMemo(() => {
    const brands = items
      .map(item => item.data.brand)
      .filter((brand): brand is string => Boolean(brand))
      .filter((brand, index, array) => array.indexOf(brand) === index)
      .sort();
    return brands;
  }, [items]);

  // Get unique error categories for filter dropdown
  const uniqueErrorCategories = useMemo(() => {
    const categories = items
      .flatMap(item => item.error_details || [])
      .map(error => error.category)
      .filter((category, index, array) => array.indexOf(category) === index)
      .sort();
    return categories;
  }, [items]);

  const handleExportCSV = () => {
      const csvData = filteredAndSortedItems.map(item => ({
          sku: item.data.model || 'UNKNOWN',
          brand: item.data.brand,
          short_model: item.data.short_model,
          printers: item.data.printers_ru.join('; '),
          weight: item.data.packaging_from_nix?.weight_g || 0,
          status: item.status,
          error_count: item.error_details?.length || 0,
          retry_count: item.retry_count || 0,
          quality_score: item.quality_score || 0,
          confidence_overall: item.data.confidence?.overall || 0,
          confidence_model: item.data.confidence?.model_name || 0,
          confidence_logistics: item.data.confidence?.logistics || 0,
          processing_time_ms: item.processing_duration_ms || 0,
          created_at: new Date(item.created_at).toISOString()
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `consumables_enhanced_${Date.now()}.csv`);
      link.click();
  };

  const handleBulkRetrySelected = () => {
    if (selectedItems.length > 0) {
      onBulkRetry(selectedItems);
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredAndSortedItems.length && filteredAndSortedItems.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredAndSortedItems.map(item => item.id));
    }
  };

  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const SortButton = ({ sortKey, children }: { sortKey: typeof sortBy, children: React.ReactNode }) => (
    <button
      onClick={() => handleSortChange(sortKey)}
      className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${
        sortBy === sortKey ? 'text-indigo-600' : 'text-slate-400'
      }`}
    >
      {children}
      {sortBy === sortKey && (
        sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />
      )}
    </button>
  );

  const processingItem = items.find(i => i.status === 'processing');
  const progressPercent = batchProgress 
    ? Math.round((batchProgress.processedItems / batchProgress.totalItems) * 100)
    : stats.total > 0 ? Math.round(((stats.ok + stats.needs_review) / stats.total) * 100) : 0;

  // Enhanced confidence score component
  const ConfidenceDisplay = ({ confidence, size = 'sm' }: { 
    confidence?: number, 
    size?: 'xs' | 'sm' | 'md' 
  }) => {
    if (confidence === undefined) return <span className="text-xs text-slate-400">--</span>;
    
    return <ConfidenceIndicator confidence={confidence} size={size} variant="dot" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="px-6 py-6 border-b border-slate-200 bg-white">
        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
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
          <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100">
              <div className="text-[10px] font-bold text-red-500 uppercase mb-1">Failed</div>
              <div className="text-2xl font-black text-red-900">{stats.failed}</div>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
              <div className="text-[10px] font-bold text-blue-500 uppercase mb-1">Retrying</div>
              <div className="text-2xl font-black text-blue-900">{stats.retrying}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Progress</div>
                <div className="text-2xl font-black text-slate-900">{progressPercent}%</div>
              </div>
              <TrendingUp className="text-slate-300" size={24} />
          </div>
        </div>

        {/* Enhanced Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Error Rate</div>
            <div className="text-lg font-black text-gray-900">{stats.error_rate.toFixed(1)}%</div>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Avg Time</div>
            <div className="text-lg font-black text-gray-900">{(stats.average_processing_time / 1000).toFixed(1)}s</div>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Manual Queue</div>
            <div className="text-lg font-black text-gray-900">{stats.manual_queue}</div>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Quality Score</div>
            <div className="text-lg font-black text-gray-900">{(stats.quality_score_average * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Batch Progress Bar */}
        {batchProgress && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-indigo-900">Batch Processing</span>
              <span className="text-xs text-indigo-600">
                {batchProgress.processedItems}/{batchProgress.totalItems} items
              </span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-2 mb-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-indigo-600">
              <span>ETA: {Math.round(batchProgress.estimatedTimeRemaining / 60)}min</span>
              <span>Rate: {batchProgress.throughputPerMinute.toFixed(1)}/min</span>
            </div>
          </div>
        )}

        {/* Error Summary */}
        {errorSummary.totalErrors > 0 && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-500" size={16} />
              <span className="text-sm font-bold text-red-900">Error Summary</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-red-600">Total: </span>
                <span className="font-bold text-red-900">{errorSummary.totalErrors}</span>
              </div>
              <div>
                <span className="text-red-600">Critical: </span>
                <span className="font-bold text-red-900">{errorSummary.criticalErrors}</span>
              </div>
              <div>
                <span className="text-red-600">Retryable: </span>
                <span className="font-bold text-red-900">{errorSummary.retryableErrors}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-white/50 glass border-b border-slate-200 flex flex-col gap-4 z-10">
          {/* Primary Search and Filter Row */}
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search by model, brand, or title..." 
                    className="w-full md:w-80 pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
              </div>
              
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                  showAdvancedFilters ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Filter size={14} />
                {showAdvancedFilters ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>

            <div className="flex gap-2 items-center">
               <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                   {['all', 'ok', 'needs_review', 'failed'].map((f) => (
                      <button 
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                      >
                        {f === 'needs_review' ? 'Review' : f}
                      </button>
                   ))}
               </div>
               
               {/* Enhanced Controls */}
               <div className="w-px h-6 bg-slate-200 mx-2"></div>
               
               {selectedItems.length > 0 && (
                 <button 
                   onClick={handleBulkRetrySelected}
                   className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-1"
                 >
                   <RefreshCw size={14} />
                   Retry ({selectedItems.length})
                 </button>
               )}
               
               {manualQueue.length > 0 && (
                 <button 
                   onClick={() => setShowManualQueue(!showManualQueue)}
                   className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                     showManualQueue 
                       ? 'bg-amber-600 text-white' 
                       : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                   }`}
                 >
                   <Users size={14} />
                   Manual Queue ({manualQueue.length})
                 </button>
               )}
               
               <button onClick={handleExportCSV} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl" title="Export Enhanced CSV">
                 <FileSpreadsheet size={20} />
               </button>
            </div>
          </div>

          {/* Advanced Filters Row */}
          {showAdvancedFilters && (
            <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Confidence:</label>
                <select 
                  value={confidenceFilter} 
                  onChange={(e) => setConfidenceFilter(e.target.value as any)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="all">All Levels</option>
                  <option value="high">High (85%+)</option>
                  <option value="medium">Medium (50-85%)</option>
                  <option value="low">Low (&lt;50%)</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Brand:</label>
                <select 
                  value={brandFilter} 
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="all">All Brands</option>
                  {uniqueBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Error Type:</label>
                <select 
                  value={errorTypeFilter} 
                  onChange={(e) => setErrorTypeFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="all">All Types</option>
                  {uniqueErrorCategories.map(category => (
                    <option key={category} value={category}>
                      {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Sort by:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="created_at">Created Date</option>
                  <option value="quality_score">Quality Score</option>
                  <option value="processing_time">Processing Time</option>
                  <option value="error_count">Error Count</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                </button>
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">
                  Showing {filteredAndSortedItems.length} of {items.length} items
                </span>
                <button
                  onClick={() => {
                    setSearch('');
                    setConfidenceFilter('all');
                    setBrandFilter('all');
                    setErrorTypeFilter('all');
                    setSortBy('created_at');
                    setSortOrder('desc');
                  }}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Processing Queue Display */}
          {(queue.length > 0 || processingItem) && (
            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/20 border border-indigo-100 overflow-hidden animate-pulse-subtle p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                   {processingItem && (
                      <div className="px-4 py-2 bg-indigo-600 text-white rounded-2xl flex items-center justify-between text-xs font-bold">
                         <span className="truncate pr-4">{processingItem.input_raw}</span>
                         <div className="flex items-center gap-1">
                           <span className="text-[10px] opacity-75">{processingItem.current_step}</span>
                           <Loader2 size={12} className="animate-spin" />
                         </div>
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

          {/* Enhanced Manual Queue Display */}
          {showManualQueue && manualQueue.length > 0 && (
            <div className="bg-amber-50 rounded-3xl border border-amber-200 overflow-hidden">
              <div className="px-6 py-4 bg-amber-100 border-b border-amber-200">
                <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  <Users size={20} />
                  Manual Review Queue
                  <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-bold rounded-full">
                    {manualQueue.length} items
                  </span>
                </h3>
                <p className="text-sm text-amber-700 mt-1">Items requiring human intervention with actionable recommendations</p>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {manualQueue.map((entry) => (
                  <div key={entry.itemId} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{entry.inputRaw}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            entry.priority === 'high' ? 'bg-red-100 text-red-700' :
                            entry.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {entry.priority} priority
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} />
                            ~{entry.estimatedResolutionTime}min
                          </span>
                          <span className="text-xs text-slate-500">
                            Attempt #{entry.attemptCount + 1}
                          </span>
                          {entry.context.confidenceScores && (
                            <ConfidenceIndicator 
                              confidence={entry.context.confidenceScores.overall} 
                              size="xs"
                              variant="badge"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button 
                          onClick={() => onRetry(entry.itemId)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
                        >
                          <RefreshCw size={12} />
                          Retry
                        </button>
                        <button 
                          onClick={() => onRemoveFromManualQueue(entry.itemId)}
                          className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      {/* Missing Fields */}
                      <div>
                        <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Missing Required Fields:
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {entry.missingFields.map(field => (
                            <span key={field} className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold">
                              {field.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Actionable Recommendations */}
                      <div>
                        <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1">
                          <Target size={12} />
                          Recommended Actions:
                        </h5>
                        <ul className="text-slate-600 space-y-1">
                          {entry.recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i} className="text-xs flex items-start gap-2">
                              <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                          {entry.recommendations.length > 3 && (
                            <li className="text-xs text-slate-400 italic">
                              +{entry.recommendations.length - 3} more recommendations...
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                    
                    {/* Error Details */}
                    {entry.failureReasons.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-amber-200">
                        <h5 className="font-bold text-slate-700 mb-2 text-xs flex items-center gap-1">
                          <Zap size={12} />
                          Error Analysis:
                        </h5>
                        <div className="space-y-2">
                          {entry.failureReasons.slice(0, 3).map((error, i) => (
                            <div key={i} className={`p-2 rounded-lg border ${
                              error.severity === 'critical' ? 'bg-red-50 border-red-200' :
                              error.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                              error.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                              'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${
                                  error.severity === 'critical' ? 'text-red-700' :
                                  error.severity === 'high' ? 'text-orange-700' :
                                  error.severity === 'medium' ? 'text-yellow-700' :
                                  'text-gray-700'
                                }`}>
                                  {error.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                  error.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                  error.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                  error.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {error.severity}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mb-1">{error.message}</p>
                              {error.suggestedAction && (
                                <p className="text-xs text-indigo-600 font-medium">
                                  💡 {error.suggestedAction}
                                </p>
                              )}
                            </div>
                          ))}
                          {entry.failureReasons.length > 3 && (
                            <div className="text-xs text-slate-400 italic text-center py-2">
                              +{entry.failureReasons.length - 3} more errors (view in detail panel)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Extracted Data Preview */}
                    {Object.keys(entry.extractedData).length > 0 && (
                      <div className="mt-4 pt-3 border-t border-amber-200">
                        <h5 className="font-bold text-slate-700 mb-2 text-xs">Extracted Data:</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {entry.extractedData.brand && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Brand:</span>
                              <span className="font-mono text-slate-700">{entry.extractedData.brand}</span>
                            </div>
                          )}
                          {entry.extractedData.model && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Model:</span>
                              <span className="font-mono text-slate-700">{entry.extractedData.model}</span>
                            </div>
                          )}
                          {entry.extractedData.consumable_type && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Type:</span>
                              <span className="font-mono text-slate-700">{entry.extractedData.consumable_type}</span>
                            </div>
                          )}
                          {entry.extractedData.printers_ru && entry.extractedData.printers_ru.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Printers:</span>
                              <span className="font-mono text-slate-700">{entry.extractedData.printers_ru.length} found</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Results Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-400">
                      <tr>
                          <th className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              onChange={handleSelectAll}
                              checked={selectedItems.length === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                              className="rounded"
                            />
                          </th>
                          <th className="px-6 py-4">
                            <SortButton sortKey="created_at">Title / SKU</SortButton>
                          </th>
                          <th className="px-6 py-4">Brand & Model</th>
                          <th className="px-6 py-4">Status & Progress</th>
                          <th className="px-6 py-4">Confidence</th>
                          <th className="px-6 py-4">
                            <SortButton sortKey="quality_score">Quality</SortButton>
                          </th>
                          <th className="px-6 py-4">
                            <SortButton sortKey="error_count">Issues</SortButton>
                          </th>
                          <th className="px-6 py-4">
                            <SortButton sortKey="processing_time">Time</SortButton>
                          </th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredAndSortedItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                              <td className="px-6 py-5">
                                <input 
                                  type="checkbox" 
                                  checked={selectedItems.includes(item.id)}
                                  onChange={() => handleSelectItem(item.id)}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-6 py-5 cursor-pointer" onClick={() => onViewItem(item)}>
                                  <div className="text-sm font-bold text-slate-900 truncate">{item.data.model || item.input_raw}</div>
                                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                                    {item.data.brand || 'Researching...'}
                                    {item.retry_count > 0 && (
                                      <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-bold">
                                        Retry {item.retry_count}
                                      </span>
                                    )}
                                  </div>
                              </td>
                              <td className="px-6 py-5">
                                  <div className="space-y-1">
                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider block w-fit">
                                      {item.data.short_model || item.data.model_alias_short || '--'}
                                    </span>
                                    {item.data.yield && (
                                      <div className="text-[9px] text-slate-500 font-mono">
                                        {item.data.yield.value} {item.data.yield.unit}
                                      </div>
                                    )}
                                  </div>
                              </td>
                              <td className="px-6 py-5">
                                  <StatusBadge 
                                    status={item.status} 
                                    step={item.current_step}
                                    confidence={item.data.confidence?.overall}
                                    showProgress={item.status === 'processing'}
                                    processingTime={item.processing_duration_ms}
                                    errorCount={item.error_details?.length}
                                  />
                              </td>
                              <td className="px-6 py-5">
                                <div className="space-y-1">
                                  <ConfidenceDisplay confidence={item.data.confidence?.overall} size="sm" />
                                  {item.data.confidence && (
                                    <div className="flex gap-1">
                                      <ConfidenceDisplay confidence={item.data.confidence.model_name} size="xs" />
                                      <ConfidenceDisplay confidence={item.data.confidence.logistics} size="xs" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                {item.quality_score ? (
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${
                                      item.quality_score > 0.8 ? 'bg-green-500' :
                                      item.quality_score > 0.6 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}></div>
                                    <span className="text-xs font-mono font-bold">
                                      {(item.quality_score * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">--</span>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                {item.error_details && item.error_details.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <AlertTriangle size={14} className="text-red-500" />
                                      <span className="text-xs text-red-600 font-bold">{item.error_details.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {item.error_details.slice(0, 2).map((error, i) => (
                                        <span key={i} className={`px-1 py-0.5 text-[8px] font-bold rounded ${
                                          error.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                          error.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                          error.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {error.category.replace(/_/g, ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">--</span>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                <div className="text-xs font-mono text-slate-500 space-y-1">
                                  {item.processing_duration_ms ? (
                                    <div>{(item.processing_duration_ms / 1000).toFixed(1)}s</div>
                                  ) : (
                                    <div>--</div>
                                  )}
                                  {item.data.packaging_from_nix?.weight_g && (
                                    <div className="text-[10px] text-slate-400">
                                      {item.data.packaging_from_nix.weight_g}g
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                  <div className="flex items-center gap-1 justify-end">
                                    {(item.status === 'failed' && item.is_retryable) && (
                                      <button 
                                        onClick={() => onRetry(item.id)}
                                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all"
                                        title="Retry processing"
                                      >
                                        <RefreshCw size={14} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => onViewItem(item)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                      title="View details"
                                    >
                                      <Edit size={14} />
                                    </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              
              {filteredAndSortedItems.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-slate-400 mb-2">
                    <Target size={48} className="mx-auto mb-4 opacity-50" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-600 mb-2">No items match your filters</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Try adjusting your search terms or filter criteria to see more results.
                  </p>
                  <button
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                      setConfidenceFilter('all');
                      setBrandFilter('all');
                      setErrorTypeFilter('all');
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ResultsView;
