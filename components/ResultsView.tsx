
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
      className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${sortBy === sortKey ? 'text-indigo-600' : 'text-slate-400'
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

    return <ConfidenceIndicator confidence={confidence} size={size} />;
  };

  return (
    <div className="flex flex-col h-full bg-transparent animate-in">
      <div className="px-6 py-8 border-b border-border-subtle bg-transparent">
        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-card p-5 rounded-[1.5rem] border border-primary-accent/10 shadow-sm">
            <div className="text-[10px] font-bold text-primary-accent uppercase mb-2 tracking-widest">Total Queue</div>
            <div className="text-3xl font-black text-primary">{stats.total}</div>
          </div>
          <div className="bg-card p-5 rounded-[1.5rem] border border-status-success/20 shadow-sm">
            <div className="text-[10px] font-bold text-status-success uppercase mb-2 tracking-widest">Approved</div>
            <div className="text-3xl font-black text-primary">{stats.ok}</div>
          </div>
          <div className="bg-card p-5 rounded-[1.5rem] border border-status-warning/20 shadow-sm">
            <div className="text-[10px] font-bold text-status-warning uppercase mb-2 tracking-widest">Review</div>
            <div className="text-3xl font-black text-primary">{stats.needs_review}</div>
          </div>
          <div className="bg-card p-5 rounded-[1.5rem] border border-status-error/20 shadow-sm">
            <div className="text-[10px] font-bold text-status-error uppercase mb-2 tracking-widest">Failed</div>
            <div className="text-3xl font-black text-primary">{stats.failed}</div>
          </div>
          <div className="bg-card p-5 rounded-[1.5rem] border border-status-info/10 shadow-sm">
            <div className="text-[10px] font-bold text-status-info uppercase mb-2 tracking-widest">Retrying</div>
            <div className="text-3xl font-black text-primary">{stats.retrying}</div>
          </div>
          <div className="bg-card p-5 rounded-[1.5rem] border border-border-subtle flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-primary-subtle uppercase mb-2 tracking-widest">Progress</div>
              <div className="text-3xl font-black text-primary">{progressPercent}%</div>
            </div>
            <TrendingUp className="text-primary-subtle/50" size={24} />
          </div>
        </div>

        {/* Enhanced Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="px-4 py-3 rounded-2xl bg-surface border border-border-subtle">
            <div className="text-[10px] font-bold text-primary-subtle uppercase mb-1 tracking-wider">Error Rate</div>
            <div className="text-lg font-bold text-primary">{stats.error_rate.toFixed(1)}%</div>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-surface border border-border-subtle">
            <div className="text-[10px] font-bold text-primary-subtle uppercase mb-1 tracking-wider">Avg Time</div>
            <div className="text-lg font-bold text-primary">{(stats.average_processing_time / 1000).toFixed(1)}s</div>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-surface border border-border-subtle">
            <div className="text-[10px] font-bold text-primary-subtle uppercase mb-1 tracking-wider">Manual Queue</div>
            <div className="text-lg font-bold text-primary">{stats.manual_queue}</div>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-surface border border-border-subtle">
            <div className="text-[10px] font-bold text-primary-subtle uppercase mb-1 tracking-wider">Quality Score</div>
            <div className="text-lg font-bold text-primary">{(stats.quality_score_average * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Batch Progress Bar */}
        {batchProgress && (
          <div className="mt-6 p-5 glass-card rounded-2xl border-indigo-500/20 bg-primary/5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-primary flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
                Batch Processing
              </span>
              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">
                {batchProgress.processedItems} / {batchProgress.totalItems} ENRICHED
              </span>
            </div>
            <div className="w-full bg-primary/5 rounded-full h-1.5 mb-3 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-700 ease-in-out shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <span>ETA: {Math.round(batchProgress.estimatedTimeRemaining / 60)}min</span>
              <span className="text-indigo-400">Rate: {batchProgress.throughputPerMinute.toFixed(1)} items/min</span>
            </div>
          </div>
        )}

        {/* Error Summary */}
        {errorSummary.totalErrors > 0 && (
          <div className="mt-4 p-4 bg-red-500/5 rounded-2xl border border-red-500/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-red-400" size={16} />
              <span className="text-xs font-bold text-red-200 uppercase tracking-widest">Error Pulse</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-[10px] font-bold">
              <div className="flex flex-col">
                <span className="text-slate-500 mb-1">TOTAL</span>
                <span className="text-primary text-lg">{errorSummary.totalErrors}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 mb-1">CRITICAL</span>
                <span className="text-red-400 text-lg">{errorSummary.criticalErrors}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 mb-1">RETRYABLE</span>
                <span className="text-blue-400 text-lg">{errorSummary.retryableErrors}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-surface backdrop-blur-md border-b border-border-subtle flex flex-col gap-4 z-10">
        {/* Primary Search and Filter Row */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search by model, brand, or title..."
                className="w-full md:w-80 pl-11 pr-4 py-2.5 bg-card border border-border-subtle rounded-xl text-sm text-primary placeholder:text-primary-subtle focus:ring-4 focus:ring-primary-accent/10 focus:border-primary-accent/50 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`premium-button px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${showAdvancedFilters ? 'bg-primary-accent text-white' : 'bg-card text-primary-subtle hover:text-primary border border-border-subtle'
                }`}
            >
              <Filter size={14} />
              Filters
              {showAdvancedFilters ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <div className="bg-card p-1 rounded-xl flex gap-1 border border-border-subtle">
              {['all', 'ok', 'needs_review', 'failed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-black rounded-lg transition-all ${filter === f ? 'bg-primary-accent text-white shadow-lg' : 'text-primary-subtle hover:text-primary'}`}
                >
                  {f === 'needs_review' ? 'Review' : f}
                </button>
              ))}
            </div>

            {/* Enhanced Controls */}
            <div className="w-px h-6 bg-slate-700 mx-2"></div>

            {selectedItems.length > 0 && (
              <button
                onClick={handleBulkRetrySelected}
                className="premium-button px-4 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 flex items-center gap-2 shadow-lg shadow-blue-900/40 border border-blue-500/20"
              >
                <RefreshCw size={14} />
                Retry {selectedItems.length}
              </button>
            )}

            {manualQueue.length > 0 && (
              <button
                onClick={() => setShowManualQueue(!showManualQueue)}
                className={`premium-button px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${showManualQueue
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40 border border-amber-500/20'
                  : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/10'
                  }`}
              >
                <Users size={14} />
                Review Pool ({manualQueue.length})
              </button>
            )}

            <button onClick={handleExportCSV} className="p-2.5 text-primary-subtle hover:text-primary hover:bg-card rounded-xl transition-all border border-border-subtle" title="Export Enhanced CSV">
              <FileSpreadsheet size={20} />
            </button>
          </div>
        </div>

        {/* Advanced Filters Row */}
        {showAdvancedFilters && (
          <div className="flex flex-wrap gap-4 p-5 bg-card border border-border-subtle rounded-2xl animate-in shadow-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence Level</label>
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-surface border border-border-subtle rounded-lg text-primary focus:border-indigo-500 outline-none"
              >
                <option value="all">All Levels</option>
                <option value="high">High (85%+)</option>
                <option value="medium">Medium (50-85%)</option>
                <option value="low">Low (&lt;50%)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Brand Filter</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-surface border border-border-subtle rounded-lg text-primary focus:border-indigo-500 outline-none"
              >
                <option value="all">All Brands</option>
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue Metadata</label>
              <select
                value={errorTypeFilter}
                onChange={(e) => setErrorTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-surface border border-border-subtle rounded-lg text-primary focus:border-indigo-500 outline-none"
              >
                <option value="all">No Exceptions</option>
                {uniqueErrorCategories.map(category => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sort Protocol</label>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 text-xs bg-surface border border-border-subtle rounded-lg text-primary focus:border-indigo-500 outline-none"
                >
                  <option value="created_at">Timestamp</option>
                  <option value="quality_score">Quality Score</option>
                  <option value="processing_time">Compute Time</option>
                  <option value="error_count">Issue Volume</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 bg-surface border border-border-subtle rounded-lg text-primary-subtle hover:text-primary transition-all"
                >
                  {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-end ml-auto gap-4">
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FILTERED SET</div>
                <div className="text-lg font-bold text-primary">{filteredAndSortedItems.length} <span className="text-primary-subtle text-xs font-medium">/ {items.length} TOTAL</span></div>
              </div>
              <button
                onClick={() => {
                  setSearch('');
                  setConfidenceFilter('all');
                  setBrandFilter('all');
                  setErrorTypeFilter('all');
                  setSortBy('created_at');
                  setSortOrder('desc');
                }}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 bg-indigo-400/10 rounded-lg border border-indigo-400/20 transition-all font-bold"
              >
                Wipe Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Processing Queue Display */}
        {(queue.length > 0 || processingItem) && (
          <div className="bg-surface rounded-3xl shadow-xl shadow-indigo-100/20 border border-indigo-100 overflow-hidden animate-pulse-subtle p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {processingItem && (
              <div className="px-4 py-2 bg-primary-accent text-white rounded-2xl flex items-center justify-between text-xs font-bold">
                <span className="truncate pr-4">{processingItem.input_raw}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] opacity-75">{processingItem.current_step}</span>
                  <Loader2 size={12} className="animate-spin" />
                </div>
              </div>
            )}
            {queue.map((q, i) => (
              <div key={i} className="px-4 py-2 bg-surface border border-border-subtle text-primary-subtle rounded-2xl flex items-center justify-between text-xs group">
                <span className="truncate pr-4">{q}</span>
                <button onClick={() => onCancelQueueItem(i)} className="opacity-0 group-hover:opacity-100 text-status-error"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Manual Queue Display */}
        {showManualQueue && manualQueue.length > 0 && (
          <div className="bg-status-warning/5 rounded-3xl border border-status-warning/20 overflow-hidden">
            <div className="px-6 py-4 bg-status-warning/10 border-b border-status-warning/20">
              <h3 className="text-lg font-bold text-status-warning flex items-center gap-2">
                <Users size={20} />
                Manual Review Queue
                <span className="px-2 py-1 bg-status-warning/20 text-status-warning text-xs font-bold rounded-full">
                  {manualQueue.length} items
                </span>
              </h3>
              <p className="text-sm text-status-warning/80 mt-1">Items requiring human intervention with actionable recommendations</p>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {manualQueue.map((entry) => (
                <div key={entry.itemId} className="bg-card rounded-xl border border-border-subtle p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-primary text-sm truncate">{entry.inputRaw}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${entry.priority === 'high' ? 'bg-status-error/10 text-status-error' :
                          entry.priority === 'medium' ? 'bg-status-warning/10 text-status-warning' :
                            'bg-surface text-primary-subtle border border-border-subtle'
                          }`}>
                          {entry.priority} priority
                        </span>
                        <span className="text-xs text-primary-subtle flex items-center gap-1">
                          <Clock size={12} />
                          ~{entry.estimatedResolutionTime}min
                        </span>
                        <span className="text-xs text-primary-subtle">
                          Attempt #{entry.attemptCount + 1}
                        </span>
                        {entry.context?.confidenceScores?.overall && (
                          <ConfidenceIndicator
                            confidence={entry.context.confidenceScores.overall}
                            size="sm"
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
                      <h5 className="font-bold text-primary-subtle mb-2 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Missing Required Fields:
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {entry.missingFields.map(field => (
                          <span key={field} className="px-2 py-1 bg-status-error/10 text-status-error border border-status-error/20 rounded font-bold">
                            {field.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actionable Recommendations */}
                    <div>
                      <h5 className="font-bold text-primary-subtle mb-2 flex items-center gap-1">
                        <Target size={12} />
                        Recommended Actions:
                      </h5>
                      <ul className="text-primary-subtle space-y-1">
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
                    <div className="mt-4 pt-3 border-t border-border-subtle">
                      <h5 className="font-bold text-primary-subtle mb-2 text-xs flex items-center gap-1">
                        <Zap size={12} />
                        Error Analysis:
                      </h5>
                      <div className="space-y-2">
                        {entry.failureReasons.slice(0, 3).map((error, i) => (
                          <div key={i} className={`p-2 rounded-lg border ${error.severity === 'critical' ? 'bg-status-error/10 border-status-error/20' :
                            error.severity === 'high' ? 'bg-status-warning/10 border-status-warning/20' :
                              error.severity === 'medium' ? 'bg-status-warning/5 border-status-warning/10' :
                                'bg-surface border-border-subtle'
                            }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-bold ${error.severity === 'critical' ? 'text-status-error' :
                                error.severity === 'high' ? 'text-status-warning' :
                                  error.severity === 'medium' ? 'text-status-warning' :
                                    'text-primary'
                                }`}>
                                {error.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                              <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${error.severity === 'critical' ? 'bg-status-error/20 text-status-error' :
                                error.severity === 'high' ? 'bg-status-warning/20 text-status-warning' :
                                  error.severity === 'medium' ? 'bg-status-warning/10 text-status-warning' :
                                    'bg-primary-subtle/10 text-primary-subtle'
                                }`}>
                                {error.severity}
                              </span>
                            </div>
                            <p className="text-xs text-primary-subtle mb-1">{error.message}</p>
                            {error.suggestedAction && (
                              <p className="text-xs text-primary-accent font-medium">
                                💡 {error.suggestedAction}
                              </p>
                            )}
                          </div>
                        ))}
                        {entry.failureReasons.length > 3 && (
                          <div className="text-xs text-primary-subtle italic text-center py-2">
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
        <div className="bg-card rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface border-b border-border-subtle text-[10px] uppercase font-black text-primary-subtle">
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
            <tbody className="divide-y divide-border-subtle">
              {filteredAndSortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-primary/5 transition-all group border-b border-border-subtle">
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="rounded bg-surface border-border-subtle text-primary-accent focus:ring-primary-accent/20"
                    />
                  </td>
                  <td className="px-6 py-5 cursor-pointer" onClick={() => onViewItem(item)}>
                    <div className="text-sm font-bold text-primary truncate group-hover:text-primary-accent transition-colors">
                      {item.data.model || item.input_raw}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mt-1">
                      {item.data.brand || 'CALCULATING...'}
                      {item.retry_count > 0 && (
                        <span className="px-1.5 py-0.5 bg-status-info/10 text-status-info rounded-md text-[8px] border border-status-info/20">
                          RETRY {item.retry_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1.5">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-black rounded-lg uppercase tracking-tighter border border-indigo-500/10 block w-fit">
                        {item.data.short_model || item.data.model_alias_short || '--'}
                      </span>
                      {item.data.yield && (
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                          <Zap size={10} className="text-amber-500/50" />
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
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-2">
                      <ConfidenceDisplay confidence={item.data.confidence?.overall} size="sm" />
                      {item.data.confidence && (
                        <div className="flex gap-2">
                          <ConfidenceDisplay confidence={item.data.confidence.model_name} size="xs" />
                          <ConfidenceDisplay confidence={item.data.confidence.logistics} size="xs" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {item.quality_score ? (
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full shadow-lg ${item.quality_score > 0.8 ? 'bg-status-success shadow-status-success/20' :
                          item.quality_score > 0.6 ? 'bg-status-warning shadow-status-warning/20' :
                            'bg-status-error shadow-status-error/20'
                          }`}></div>
                        <span className="text-xs font-black text-primary-subtle">
                          {(item.quality_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-primary-subtle/50 font-bold">--</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {item.error_details && item.error_details.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} className="text-red-400" />
                          <span className="text-xs text-red-400 font-black">{item.error_details.length}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.error_details.slice(0, 2).map((error, i) => (
                            <span key={i} className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md border ${error.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              error.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                'bg-white/5 text-slate-500 border-white/5'
                              }`}>
                              {error.category.split('_')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 font-bold">--</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs font-black text-slate-400 space-y-1.5 uppercase tracking-widest">
                      {item.processing_duration_ms ? (
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-600" />
                          {(item.processing_duration_ms / 1000).toFixed(1)}s
                        </div>
                      ) : (
                        <div>--</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {(item.status === 'failed' && item.is_retryable) && (
                        <button
                          onClick={() => onRetry(item.id)}
                          className="p-2 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-xl border border-transparent hover:border-blue-500/20 transition-all"
                          title="Retry processing"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onViewItem(item)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all font-bold"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSortedItems.length === 0 && (
            <div className="py-24 text-center animate-in">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                <Target size={32} className="text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Null result on criteria</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto font-medium">
                The current parameters returned zero matches. Adjust your filters or audit the original input data.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                  setConfidenceFilter('all');
                  setBrandFilter('all');
                  setErrorTypeFilter('all');
                }}
                className="premium-button px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-900/40"
              >
                Clear All Constraints
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
