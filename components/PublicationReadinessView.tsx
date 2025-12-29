import React, { useState, useMemo } from 'react';
import { EnrichedItem, PublicationReadinessReport } from '../types';
import {
  evaluatePublicationReadiness,
  generatePublicationReadinessReport,
  performBulkApproval,
  getPublicationReadyItems,
  getItemsNeedingAttention,
  BulkApprovalCriteria,
  PublicationReadinessScore
} from '../services/publicationReadinessService';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Filter,
  Download,
  Settings,
  Users,
  BarChart3,
  PieChart,
  Zap,
  Award,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import ConfidenceIndicator from './ConfidenceIndicator';

interface PublicationReadinessViewProps {
  items: EnrichedItem[];
  onViewItem: (item: EnrichedItem) => void;
  onBulkApprove: (itemIds: string[]) => void;
  onUpdateItem: (id: string, updates: Partial<EnrichedItem>) => void;
}

const PublicationReadinessView: React.FC<PublicationReadinessViewProps> = ({
  items,
  onViewItem,
  onBulkApprove,
  onUpdateItem
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ready' | 'needs_work' | 'bulk_approval'>('dashboard');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [bulkCriteria, setBulkCriteria] = useState<BulkApprovalCriteria>({
    minimum_readiness_score: 0.7,
    required_confidence_level: 'medium',
    require_russian_verification: true,
    require_valid_image: false,
    require_nix_packaging: true,
    exclude_error_categories: ['critical'],
    include_brands: [],
    exclude_brands: []
  });

  // Generate comprehensive report
  const report = useMemo<PublicationReadinessReport>(() => generatePublicationReadinessReport(items), [items]);

  // Get categorized items
  const readyItems = useMemo(() => getPublicationReadyItems(items), [items]);
  const itemsNeedingWork = useMemo(() => getItemsNeedingAttention(items), [items]);

  // Calculate readiness scores for all items
  const itemsWithReadiness = useMemo(() =>
    items.map(item => ({
      item,
      readiness: evaluatePublicationReadiness(item)
    })), [items]
  );

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = (itemList: EnrichedItem[]) => {
    const allIds = itemList.map(item => item.id);
    const allSelected = allIds.every(id => selectedItems.includes(id));

    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedItems(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleBulkApproval = () => {
    const result = performBulkApproval(items, bulkCriteria);
    onBulkApprove(result.approved_items);

    // Show results
    alert(`Bulk Approval Complete:\n${result.summary.approved_count} items approved\n${result.summary.rejected_count} items rejected\nApproval rate: ${result.summary.approval_rate.toFixed(1)}%`);
  };

  const ReadinessScoreDisplay = ({ score, size = 'md' }: { score: number, size?: 'sm' | 'md' | 'lg' }) => {
    const percentage = Math.round(score * 100);
    const color = score >= 0.8 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
      score >= 0.6 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
        'text-red-400 border-red-500/30 bg-red-500/10';

    const sizeClasses = {
      sm: 'text-[10px] px-2 py-0.5',
      md: 'text-xs px-3 py-1',
      lg: 'text-xl px-5 py-2'
    };

    return (
      <span className={`${sizeClasses[size]} ${color} border rounded-xl font-black uppercase tracking-widest flex items-center gap-2 w-fit`}>
        <div className={`w-1.5 h-1.5 rounded-full ${score >= 0.8 ? 'bg-emerald-400' : score >= 0.6 ? 'bg-amber-400' : 'bg-red-400'} shadow-[0_0_8px_currentColor]`}></div>
        {percentage}%
      </span>
    );
  };

  const ComponentScoreBar = ({ label, score, color }: { label: string, score: number, color: string }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-black text-primary">{Math.round(score * 100)}%</span>
      </div>
      <div className="w-full bg-surface rounded-full h-1 border border-border-subtle">
        <div
          className={`h-1 rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${score * 100}%` }}
        ></div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-[2rem] border-emerald-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="text-emerald-400" size={20} />
            </div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Stable</span>
          </div>
          <div className="text-4xl font-black text-primary">{report.ready_for_publication}</div>
          <div className="text-[10px] font-bold text-primary-subtle mt-2 uppercase tracking-tighter">
            {items.length > 0 ? Math.round((report.ready_for_publication / items.length) * 100) : 0}% COMPLETION RATE
          </div>
        </div>

        <div className="glass-card p-6 rounded-[2rem] border-amber-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <Clock className="text-amber-400" size={20} />
            </div>
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Optimizable</span>
          </div>
          <div className="text-4xl font-black text-primary">{report.needs_minor_fixes}</div>
          <div className="text-[10px] font-bold text-primary-subtle mt-2 uppercase tracking-tighter">MINOR GAPS DETECTED</div>
        </div>

        <div className="glass-card p-6 rounded-[2rem] border-orange-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-500/10 rounded-xl">
              <AlertTriangle className="text-orange-400" size={20} />
            </div>
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Critical</span>
          </div>
          <div className="text-4xl font-black text-primary">{report.needs_major_work}</div>
          <div className="text-[10px] font-bold text-primary-subtle mt-2 uppercase tracking-tighter">STRUCTURAL WORK NEEDED</div>
        </div>

        <div className="glass-card p-6 rounded-[2rem] border-red-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <XCircle className="text-red-400" size={20} />
            </div>
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Blocked</span>
          </div>
          <div className="text-4xl font-black text-primary">{report.blocked_items}</div>
          <div className="text-[10px] font-bold text-primary-subtle mt-2 uppercase tracking-tighter">IMMEDIATE ATTENTION</div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Overall Quality Score */}
        <div className="glass-card rounded-[2.5rem] border-border-subtle p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-primary flex items-center gap-3">
                <Award className="text-primary-accent" size={24} />
                Integrity Matrix
              </h3>
              <p className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">Aggregate Verification Score</p>
            </div>
            <ReadinessScoreDisplay score={report.average_readiness_score} size="lg" />
          </div>

          <div className="space-y-6">
            <ComponentScoreBar
              label="Linguistic Precision"
              score={0.88}
              color="bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]"
            />
            <ComponentScoreBar
              label="Logistics Accuracy"
              score={0.76}
              color="bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            />
            <ComponentScoreBar
              label="Market Compliance"
              score={0.71}
              color="bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]"
            />
            <ComponentScoreBar
              label="Visual Integrity"
              score={0.52}
              color="bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]"
            />
            <ComponentScoreBar
              label="Source Reliability"
              score={0.82}
              color="bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.5)]"
            />
          </div>
        </div>

        {/* Top Blocking Issues */}
        <div className="glass-card rounded-[2.5rem] border-border-subtle p-8">
          <div className="flex flex-col gap-1 mb-8">
            <h3 className="text-lg font-bold text-primary flex items-center gap-3">
              <AlertCircle className="text-red-400" size={24} />
              Issue Taxonomy
            </h3>
            <p className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">Structural Deployment Blockers</p>
          </div>

          <div className="space-y-3">
            {report.top_blocking_issues.slice(0, 5).map((issue, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-subtle group hover:border-primary-accent/30 transition-all">
                <div className="flex-1">
                  <div className="text-sm font-bold text-primary group-hover:text-primary-accent transition-colors uppercase tracking-tight">{issue.issue}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md ${issue.severity === 'high' ? 'bg-red-500 text-white' :
                      issue.severity === 'medium' ? 'bg-amber-500 text-white' :
                        'bg-surface text-primary-subtle border border-border-subtle'
                      }`}>
                      {issue.severity}
                    </span>
                    <span className="text-[10px] font-bold text-primary-subtle uppercase tracking-widest">{issue.count} INCIDENTS</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-primary">{issue.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Brand Performance */}
      <div className="glass-card rounded-[2.5rem] border-border-subtle p-8">
        <div className="flex flex-col gap-1 mb-8">
          <h3 className="text-lg font-bold text-primary flex items-center gap-3">
            <BarChart3 className="text-primary-accent" size={24} />
            Strategic Brand Readiness
          </h3>
          <p className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">Cross-sectional Distribution</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(report.readiness_by_brand)
            .sort(([, a]: [string, any], [, b]: [string, any]) => b.avg_score - a.avg_score)
            .map(([brand, stats]: [string, any]) => (
              <div key={brand} className="bg-surface rounded-[1.5rem] p-6 border border-border-subtle hover:border-primary-accent/30 transition-all group">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-primary group-hover:text-primary-accent transition-colors">{brand}</h3>
                  <ReadinessScoreDisplay score={stats.avg_score} size="sm" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">VOLUME</span>
                    <span className="text-sm font-bold text-primary-subtle">{stats.ready} <span className="text-primary-subtle/70">/ {stats.total}</span></span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1 border border-border-subtle overflow-hidden">
                    <div
                      className="bg-primary-accent h-1 rounded-full transition-all duration-300"
                      style={{ width: `${(stats.ready / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Quality Trends */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-8 rounded-[2rem] border-emerald-500/10 flex items-center gap-6">
          <div className="p-4 bg-emerald-500/10 rounded-2xl">
            <TrendingUp className="text-emerald-400" size={32} />
          </div>
          <div>
            <div className="text-3xl font-black text-primary">{report.quality_trends.improving}</div>
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Positive Trajectory</div>
          </div>
        </div>
        <div className="glass-card p-8 rounded-[2rem] border-blue-500/10 flex items-center gap-6">
          <div className="p-4 bg-blue-500/10 rounded-2xl">
            <Target className="text-blue-400" size={32} />
          </div>
          <div>
            <div className="text-3xl font-black text-primary">{report.quality_trends.stable}</div>
            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Stabilized State</div>
          </div>
        </div>
        <div className="glass-card p-8 rounded-[2rem] border-red-500/10 flex items-center gap-6">
          <div className="p-4 bg-red-500/10 rounded-2xl">
            <TrendingDown className="text-red-400" size={32} />
          </div>
          <div>
            <div className="text-3xl font-black text-primary">{report.quality_trends.declining}</div>
            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Degradation Risks</div>
          </div>
        </div>
      </div>
    </div>
  );
  const renderReadyItems = () => (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold text-primary flex items-center gap-3">
            <CheckCircle className="text-emerald-400" size={24} />
            Verified Readiness Queue
          </h3>
          <p className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">{readyItems.length} ITEMS PASSING ALL PROTOCOLS</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSelectAll(readyItems)}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary-subtle hover:text-primary border border-border-subtle rounded-xl hover:bg-card transition-all"
          >
            {readyItems.every(item => selectedItems.includes(item.id)) ? 'Wipe Selection' : 'Select All'}
          </button>
          {selectedItems.length > 0 && (
            <button
              onClick={() => onBulkApprove(selectedItems.filter(id => readyItems.some(item => item.id === id)))}
              className="premium-button px-5 py-2.5 bg-status-success text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-status-success/90 flex items-center gap-2 shadow-lg shadow-emerald-900/40 border border-status-success/20"
            >
              <Zap size={14} />
              Approve Set ({selectedItems.filter(id => readyItems.some(item => item.id === id)).length})
            </button>
          )}
        </div>
      </div>

      <div className="glass-card rounded-[2rem] border-border-subtle overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-black text-primary-subtle uppercase tracking-widest border-b border-border-subtle">
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  onChange={() => handleSelectAll(readyItems)}
                  checked={readyItems.length > 0 && readyItems.every(item => selectedItems.includes(item.id))}
                  className="rounded bg-surface border-border-subtle text-primary-accent focus:ring-primary-accent/20"
                />
              </th>
              <th className="px-6 py-4 text-left">Entity Architecture</th>
              <th className="px-6 py-4 text-left">Readiness</th>
              <th className="px-6 py-4 text-left">Confidence</th>
              <th className="px-6 py-4 text-left">Market Verification</th>
              <th className="px-6 py-4 text-right">Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {readyItems.map(item => {
              const readiness = evaluatePublicationReadiness(item);
              return (
                <tr key={item.id} className="hover:bg-primary/5 transition-all group">
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="rounded bg-surface border-border-subtle text-primary-accent focus:ring-primary-accent/20"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-bold text-primary-subtle group-hover:text-primary transition-colors">{item.data.model || item.input_raw}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary-subtle mt-1">{item.data.brand}</div>
                  </td>
                  <td className="px-6 py-5">
                    <ReadinessScoreDisplay score={readiness.overall_score} size="sm" />
                  </td>
                  <td className="px-6 py-5">
                    <ConfidenceIndicator
                      confidence={item.data.confidence?.overall || 0}
                      size="sm"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-accent"></div>
                      <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">
                        {item.data.compatible_printers_ru?.filter(p => p.ruMarketEligibility === 'ru_verified').length || 0} VERIFIED SOURCES
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => onViewItem(item)}
                      className="p-2 text-primary-subtle hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-border-subtle"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderNeedsWork = () => (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-primary flex items-center gap-3">
          <AlertTriangle className="text-amber-400" size={24} />
          Structural Review Queue
        </h3>
        <p className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">{itemsNeedingWork.length} ENTITIES REQUIRING MANUAL OVERRIDE</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {itemsNeedingWork.map(({ item, readiness, priority }) => (
          <div key={item.id} className="glass-card rounded-[2.5rem] border-border-subtle p-8 group hover:border-primary-accent/30 transition-all">
            <div className="flex items-start justify-between mb-8">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <h4 className="text-xl font-black text-primary group-hover:text-amber-400 transition-colors">{item.data.model || item.input_raw}</h4>
                  <ReadinessScoreDisplay score={readiness.overall_score} />
                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-xl border ${priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-surface text-primary-subtle border-border-subtle'
                    }`}>
                    {priority} PRIORITY
                  </span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-primary-subtle">{item.data.brand}</div>

                {/* Component Scores */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8">
                  <ComponentScoreBar
                    label="REQUIRED"
                    score={readiness.component_scores.required_fields}
                    color="bg-indigo-500"
                  />
                  <ComponentScoreBar
                    label="QUALITY"
                    score={readiness.component_scores.data_quality}
                    color="bg-emerald-500"
                  />
                  <ComponentScoreBar
                    label="RUSSIAN"
                    score={readiness.component_scores.russian_market}
                    color="bg-purple-500"
                  />
                  <ComponentScoreBar
                    label="IMAGES"
                    score={readiness.component_scores.image_validation}
                    color="bg-orange-500"
                  />
                  <ComponentScoreBar
                    label="SOURCES"
                    score={readiness.component_scores.source_reliability}
                    color="bg-teal-500"
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 ml-8">
                <div className="px-3 py-1.5 bg-background rounded-xl border border-border-subtle flex items-center gap-2">
                  <Clock size={12} className="text-primary-subtle" />
                  <span className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">
                    EST. {readiness.estimated_manual_effort}M
                  </span>
                </div>
                <button
                  onClick={() => onViewItem(item)}
                  className="p-3 bg-primary-accent/10 text-primary-accent hover:text-white hover:bg-primary-accent rounded-2xl transition-all border border-primary-accent/20 group-hover:scale-105"
                >
                  <Eye size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
              {/* Blocking Issues */}
              {readiness.blocking_issues.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black text-red-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <XCircle size={14} />
                    CRITICAL BLOCKERS
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {readiness.blocking_issues.map((issue, i) => (
                      <span key={i} className="px-3 py-1.5 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/20">
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {readiness.recommendations.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black text-indigo-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Target size={14} />
                    OPTIMIZATION VECTOR
                  </h5>
                  <ul className="space-y-2">
                    {readiness.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 bg-background p-3 rounded-2xl border border-border-subtle">
                        <div className="w-1 h-1 rounded-full bg-primary-accent mt-2"></div>
                        <span className="text-[11px] font-bold text-primary-subtle leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBulkApproval = () => (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-primary flex items-center gap-3">
          <Zap className="text-primary-accent" size={24} />
          Protocol Enforcement System
        </h3>
        <p className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">MASS APPROVAL & DEPLOYMENT AUTOMATION</p>
      </div>

      {/* Criteria Configuration */}
      <div className="glass-card rounded-[2.5rem] border-border-subtle p-8">
        <h4 className="text-[10px] font-black text-primary-subtle mb-8 flex items-center gap-3 uppercase tracking-widest">
          <Settings className="text-primary-accent" size={16} />
          Approval Parameters
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="group">
              <label className="block text-[10px] font-black text-primary-subtle mb-4 uppercase tracking-[0.2em] group-focus-within:text-primary-accent transition-colors">
                Minimum Readiness Threshold
              </label>
              <div className="flex items-center gap-6">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bulkCriteria.minimum_readiness_score}
                  onChange={(e) => setBulkCriteria(prev => ({
                    ...prev,
                    minimum_readiness_score: parseFloat(e.target.value)
                  }))}
                  className="flex-1 accent-primary-accent"
                />
                <div className="text-2xl font-black text-primary w-16 tabular-nums">
                  {Math.round(bulkCriteria.minimum_readiness_score * 100)}%
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block text-[10px] font-black text-primary-subtle mb-4 uppercase tracking-[0.2em] group-focus-within:text-primary-accent transition-colors">
                Required Confidence Protocol
              </label>
              <select
                value={bulkCriteria.required_confidence_level}
                onChange={(e) => setBulkCriteria(prev => ({
                  ...prev,
                  required_confidence_level: e.target.value as 'high' | 'medium' | 'low'
                }))}
                className="w-full px-4 py-3 bg-card border border-border-subtle rounded-2xl text-primary text-sm font-bold focus:border-primary-accent outline-none transition-all"
              >
                <option value="low">LOW ACCURACY (40%+)</option>
                <option value="medium">STANDARD OPS (60%+)</option>
                <option value="high">HIGH PRECISION (85%+)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-card rounded-[2rem] border border-border-subtle space-y-4">
              <label className="flex items-center gap-4 group cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={bulkCriteria.require_russian_verification}
                    onChange={(e) => setBulkCriteria(prev => ({
                      ...prev,
                      require_russian_verification: e.target.checked
                    }))}
                    className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                  />
                  <div className="h-5 w-5 bg-surface rounded-md border border-border-subtle peer-checked:bg-primary-accent peer-checked:border-primary-accent transition-all flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary-subtle group-hover:text-primary transition-colors uppercase tracking-tight">Require RU Market Auth</span>
              </label>

              <label className="flex items-center gap-4 group cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={bulkCriteria.require_valid_image}
                    onChange={(e) => setBulkCriteria(prev => ({
                      ...prev,
                      require_valid_image: e.target.checked
                    }))}
                    className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                  />
                  <div className="h-5 w-5 bg-surface rounded-md border border-border-subtle peer-checked:bg-primary-accent peer-checked:border-primary-accent transition-all flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary-subtle group-hover:text-primary transition-colors uppercase tracking-tight">Require Valid Image ID</span>
              </label>

              <label className="flex items-center gap-4 group cursor-pointer">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={bulkCriteria.require_nix_packaging}
                    onChange={(e) => setBulkCriteria(prev => ({
                      ...prev,
                      require_nix_packaging: e.target.checked
                    }))}
                    className="peer h-5 w-5 opacity-0 absolute cursor-pointer"
                  />
                  <div className="h-5 w-5 bg-surface rounded-md border border-border-subtle peer-checked:bg-primary-accent peer-checked:border-primary-accent transition-all flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary-subtle group-hover:text-primary transition-colors uppercase tracking-tight">Require Logistics Data</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border-subtle flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-black text-primary-subtle uppercase tracking-widest">SIMULATED OUTCOME</div>
            <div className="text-sm font-bold text-primary-subtle">
              Approximately <span className="text-primary-accent tabular-nums">{performBulkApproval(items, bulkCriteria).summary.approved_count}</span> entities qualify for injection.
            </div>
          </div>
          <button
            onClick={handleBulkApproval}
            className="premium-button px-8 py-4 bg-primary-accent text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary-accent-hover transition-all flex items-center gap-3 shadow-lg shadow-indigo-900/40 border border-primary-accent/20"
          >
            <Zap size={18} />
            Execute Protocol
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent animate-in">
      {/* Header */}
      <div className="px-8 py-8 border-b border-border-subtle bg-transparent">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-primary flex items-center gap-3">
              <Award className="text-primary-accent" size={28} />
              Readiness Protocol
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-subtle">Analytics & Publication Deployment</p>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <div className="text-[10px] font-black text-primary-subtle uppercase tracking-widest mb-1">NETWORK READY</div>
              <div className="text-xl font-bold text-primary tabular-nums">
                {report.ready_for_publication} <span className="text-primary-subtle/70 font-medium text-xs">/ {items.length}</span>
              </div>
            </div>
            <div className="w-48 bg-surface rounded-full h-1.5 overflow-hidden border border-border-subtle">
              <div
                className="bg-primary-accent h-1.5 rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                style={{ width: `${items.length > 0 ? (report.ready_for_publication / items.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-surface p-1.5 rounded-2xl w-fit border border-border-subtle">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { key: 'ready', label: `Ready (${readyItems.length})`, icon: CheckCircle },
            { key: 'needs_work', label: `Review (${itemsNeedingWork.length})`, icon: AlertTriangle },
            { key: 'bulk_approval', label: 'Bulk Ops', icon: Zap }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2.5 ${activeTab === tab.key
                ? 'bg-primary-accent text-white shadow-lg shadow-indigo-900/40'
                : 'text-primary-subtle hover:text-primary hover:bg-primary/5'
                }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'ready' && renderReadyItems()}
        {activeTab === 'needs_work' && renderNeedsWork()}
        {activeTab === 'bulk_approval' && renderBulkApproval()}
      </div>
    </div>
  );
};

export default PublicationReadinessView;