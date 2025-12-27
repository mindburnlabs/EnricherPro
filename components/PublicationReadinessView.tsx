import React, { useState, useMemo } from 'react';
import { EnrichedItem } from '../types';
import { 
  evaluatePublicationReadiness,
  generatePublicationReadinessReport,
  performBulkApproval,
  getPublicationReadyItems,
  getItemsNeedingAttention,
  BulkApprovalCriteria,
  PublicationReadinessScore,
  PublicationReadinessReport
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
  const report = useMemo(() => generatePublicationReadinessReport(items), [items]);
  
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
    const color = score >= 0.8 ? 'text-green-600' : score >= 0.6 ? 'text-yellow-600' : 'text-red-600';
    const bgColor = score >= 0.8 ? 'bg-green-100' : score >= 0.6 ? 'bg-yellow-100' : 'bg-red-100';
    
    const sizeClasses = {
      sm: 'text-xs px-2 py-1',
      md: 'text-sm px-3 py-1',
      lg: 'text-lg px-4 py-2'
    };

    return (
      <span className={`${sizeClasses[size]} ${color} ${bgColor} rounded-full font-bold`}>
        {percentage}%
      </span>
    );
  };

  const ComponentScoreBar = ({ label, score, color }: { label: string, score: number, color: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{Math.round(score * 100)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${score * 100}%` }}
        ></div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-green-50 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-green-600" size={24} />
            <span className="text-xs font-bold text-green-600 uppercase">Ready</span>
          </div>
          <div className="text-3xl font-black text-green-900">{report.ready_for_publication}</div>
          <div className="text-xs text-green-600 mt-1">
            {items.length > 0 ? Math.round((report.ready_for_publication / items.length) * 100) : 0}% of total
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-yellow-50 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-yellow-600" size={24} />
            <span className="text-xs font-bold text-yellow-600 uppercase">Minor Fixes</span>
          </div>
          <div className="text-3xl font-black text-yellow-900">{report.needs_minor_fixes}</div>
          <div className="text-xs text-yellow-600 mt-1">Quick improvements needed</div>
        </div>

        <div className="p-6 rounded-2xl bg-orange-50 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="text-orange-600" size={24} />
            <span className="text-xs font-bold text-orange-600 uppercase">Major Work</span>
          </div>
          <div className="text-3xl font-black text-orange-900">{report.needs_major_work}</div>
          <div className="text-xs text-orange-600 mt-1">Significant effort required</div>
        </div>

        <div className="p-6 rounded-2xl bg-red-50 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="text-red-600" size={24} />
            <span className="text-xs font-bold text-red-600 uppercase">Blocked</span>
          </div>
          <div className="text-3xl font-black text-red-900">{report.blocked_items}</div>
          <div className="text-xs text-red-600 mt-1">Critical issues</div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Quality Score */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="text-indigo-600" size={20} />
              Overall Quality Score
            </h3>
            <ReadinessScoreDisplay score={report.average_readiness_score} size="lg" />
          </div>
          
          <div className="space-y-4">
            <ComponentScoreBar 
              label="Required Fields" 
              score={0.85} 
              color="bg-blue-500" 
            />
            <ComponentScoreBar 
              label="Data Quality" 
              score={0.72} 
              color="bg-green-500" 
            />
            <ComponentScoreBar 
              label="Russian Market" 
              score={0.68} 
              color="bg-purple-500" 
            />
            <ComponentScoreBar 
              label="Image Validation" 
              score={0.45} 
              color="bg-orange-500" 
            />
            <ComponentScoreBar 
              label="Source Reliability" 
              score={0.78} 
              color="bg-teal-500" 
            />
          </div>
        </div>

        {/* Top Blocking Issues */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            Top Blocking Issues
          </h3>
          
          <div className="space-y-3">
            {report.top_blocking_issues.slice(0, 5).map((issue, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{issue.issue}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                      issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs text-slate-500">{issue.count} items affected</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">{issue.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Brand Performance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="text-indigo-600" size={20} />
          Readiness by Brand
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(report.readiness_by_brand)
            .sort(([,a], [,b]) => b.avg_score - a.avg_score)
            .slice(0, 6)
            .map(([brand, stats]) => (
            <div key={brand} className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 truncate">{brand}</h4>
                <ReadinessScoreDisplay score={stats.avg_score} size="sm" />
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Ready:</span>
                  <span className="font-bold">{stats.ready}/{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate:</span>
                  <span className="font-bold">{Math.round((stats.ready / stats.total) * 100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Trends */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="text-green-600" size={20} />
          Quality Trends
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <TrendingUp className="text-green-600 mx-auto mb-2" size={24} />
            <div className="text-2xl font-bold text-green-900">{report.quality_trends.improving}</div>
            <div className="text-xs text-green-600">Improving</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <Target className="text-blue-600 mx-auto mb-2" size={24} />
            <div className="text-2xl font-bold text-blue-900">{report.quality_trends.stable}</div>
            <div className="text-xs text-blue-600">Stable</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <TrendingDown className="text-red-600 mx-auto mb-2" size={24} />
            <div className="text-2xl font-bold text-red-900">{report.quality_trends.declining}</div>
            <div className="text-xs text-red-600">Declining</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReadyItems = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle className="text-green-600" size={20} />
          Publication Ready Items ({readyItems.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleSelectAll(readyItems)}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            {readyItems.every(item => selectedItems.includes(item.id)) ? 'Deselect All' : 'Select All'}
          </button>
          {selectedItems.length > 0 && (
            <button
              onClick={() => onBulkApprove(selectedItems.filter(id => readyItems.some(item => item.id === id)))}
              className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 flex items-center gap-1"
            >
              <CheckCircle size={14} />
              Approve Selected ({selectedItems.filter(id => readyItems.some(item => item.id === id)).length})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-bold text-slate-600 uppercase">
              <th className="px-4 py-3 text-left">
                <input 
                  type="checkbox" 
                  onChange={() => handleSelectAll(readyItems)}
                  checked={readyItems.length > 0 && readyItems.every(item => selectedItems.includes(item.id))}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Readiness Score</th>
              <th className="px-4 py-3 text-left">Confidence</th>
              <th className="px-4 py-3 text-left">Russian Market</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {readyItems.map(item => {
              const readiness = evaluatePublicationReadiness(item);
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.data.model || item.input_raw}</div>
                    <div className="text-xs text-slate-500">{item.data.brand}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ReadinessScoreDisplay score={readiness.overall_score} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceIndicator 
                      confidence={item.data.confidence?.overall || 0} 
                      size="sm" 
                      variant="badge"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      {item.data.compatible_printers_ru?.filter(p => p.ruMarketEligibility === 'ru_verified').length || 0} verified
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewItem(item)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                    >
                      <Eye size={16} />
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
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <AlertTriangle className="text-yellow-600" size={20} />
        Items Needing Work ({itemsNeedingWork.length})
      </h3>

      <div className="space-y-4">
        {itemsNeedingWork.map(({ item, readiness, priority }) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-bold text-slate-900">{item.data.model || item.input_raw}</h4>
                  <ReadinessScoreDisplay score={readiness.overall_score} />
                  <span className={`px-2 py-1 text-xs font-bold rounded ${
                    priority === 'high' ? 'bg-red-100 text-red-700' :
                    priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {priority} priority
                  </span>
                </div>
                <div className="text-sm text-slate-600 mb-3">{item.data.brand}</div>
                
                {/* Component Scores */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <ComponentScoreBar 
                    label="Required" 
                    score={readiness.component_scores.required_fields} 
                    color="bg-blue-500" 
                  />
                  <ComponentScoreBar 
                    label="Quality" 
                    score={readiness.component_scores.data_quality} 
                    color="bg-green-500" 
                  />
                  <ComponentScoreBar 
                    label="Russian" 
                    score={readiness.component_scores.russian_market} 
                    color="bg-purple-500" 
                  />
                  <ComponentScoreBar 
                    label="Images" 
                    score={readiness.component_scores.image_validation} 
                    color="bg-orange-500" 
                  />
                  <ComponentScoreBar 
                    label="Sources" 
                    score={readiness.component_scores.source_reliability} 
                    color="bg-teal-500" 
                  />
                </div>
              </div>
              
              <div className="flex gap-2 ml-4">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={12} />
                  ~{readiness.estimated_manual_effort}min
                </span>
                <button
                  onClick={() => onViewItem(item)}
                  className="p-2 text-slate-400 hover:text-indigo-600 rounded"
                >
                  <Eye size={16} />
                </button>
              </div>
            </div>

            {/* Blocking Issues */}
            {readiness.blocking_issues.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1">
                  <XCircle size={14} />
                  Blocking Issues:
                </h5>
                <div className="flex flex-wrap gap-2">
                  {readiness.blocking_issues.map((issue, i) => (
                    <span key={i} className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {readiness.recommendations.length > 0 && (
              <div>
                <h5 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1">
                  <Target size={14} />
                  Recommendations:
                </h5>
                <ul className="text-xs text-slate-600 space-y-1">
                  {readiness.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                  {readiness.recommendations.length > 3 && (
                    <li className="text-slate-400 italic">
                      +{readiness.recommendations.length - 3} more recommendations...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderBulkApproval = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Users className="text-indigo-600" size={20} />
        Bulk Approval System
      </h3>

      {/* Criteria Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="text-slate-600" size={16} />
          Approval Criteria
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Readiness Score
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={bulkCriteria.minimum_readiness_score}
                onChange={(e) => setBulkCriteria(prev => ({
                  ...prev,
                  minimum_readiness_score: parseFloat(e.target.value)
                }))}
                className="w-full"
              />
              <div className="text-xs text-slate-500 mt-1">
                {Math.round(bulkCriteria.minimum_readiness_score * 100)}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Required Confidence Level
              </label>
              <select
                value={bulkCriteria.required_confidence_level}
                onChange={(e) => setBulkCriteria(prev => ({
                  ...prev,
                  required_confidence_level: e.target.value as 'high' | 'medium' | 'low'
                }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="low">Low (40%+)</option>
                <option value="medium">Medium (60%+)</option>
                <option value="high">High (80%+)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkCriteria.require_russian_verification}
                  onChange={(e) => setBulkCriteria(prev => ({
                    ...prev,
                    require_russian_verification: e.target.checked
                  }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-700">Require Russian Market Verification</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkCriteria.require_valid_image}
                  onChange={(e) => setBulkCriteria(prev => ({
                    ...prev,
                    require_valid_image: e.target.checked
                  }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-700">Require Valid Product Image</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bulkCriteria.require_nix_packaging}
                  onChange={(e) => setBulkCriteria(prev => ({
                    ...prev,
                    require_nix_packaging: e.target.checked
                  }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-700">Require NIX.ru Package Data</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={handleBulkApproval}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Zap size={16} />
            Run Bulk Approval
          </button>
        </div>
      </div>

      {/* Preview Results */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h4 className="font-bold text-slate-900 mb-4">Preview Results</h4>
        <div className="text-sm text-slate-600">
          Based on current criteria, approximately{' '}
          <span className="font-bold text-indigo-600">
            {performBulkApproval(items, bulkCriteria).summary.approved_count}
          </span>{' '}
          items would be approved out of {items.length} total items.
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="text-indigo-600" size={24} />
            Publication Readiness System
          </h2>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              {report.ready_for_publication} of {items.length} ready
            </span>
            <div className="w-32 bg-slate-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${items.length > 0 ? (report.ready_for_publication / items.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { key: 'ready', label: `Ready (${readyItems.length})`, icon: CheckCircle },
            { key: 'needs_work', label: `Needs Work (${itemsNeedingWork.length})`, icon: AlertTriangle },
            { key: 'bulk_approval', label: 'Bulk Approval', icon: Users }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === tab.key 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'ready' && renderReadyItems()}
        {activeTab === 'needs_work' && renderNeedsWork()}
        {activeTab === 'bulk_approval' && renderBulkApproval()}
      </div>
    </div>
  );
};

export default PublicationReadinessView;