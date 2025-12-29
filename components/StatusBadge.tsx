
import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Clock, Loader2, Search, Database, Brain, Sparkles, Zap, Shield, Eye, Target } from 'lucide-react';
import { ValidationStatus, ProcessingStep } from '../types';

interface StatusBadgeProps {
  status: ValidationStatus;
  step?: ProcessingStep;
  confidence?: number;
  showProgress?: boolean;
  processingTime?: number;
  errorCount?: number;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  step,
  confidence,
  showProgress = false,
  processingTime,
  errorCount
}) => {
  const baseClasses = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-all";

  if (status === 'processing') {
    const stepLabels: Record<ProcessingStep, { label: string, icon: any, description: string, color: string }> = {
      idle: {
        label: 'Initializing',
        icon: Clock,
        description: 'Preparing for processing',
        color: 'bg-slate-50 text-slate-700 border-slate-200'
      },
      searching: {
        label: 'Research Phase',
        icon: Search,
        description: 'Conducting grounded search',
        color: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      scraping_nix: {
        label: 'NIX.ru Logistics',
        icon: Database,
        description: 'Fetching package dimensions',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      scraping_compat: {
        label: 'Compatibility Sync',
        icon: Shield,
        description: 'Verifying printer compatibility',
        color: 'bg-purple-50 text-purple-700 border-purple-200'
      },
      analyzing: {
        label: 'AI Synthesis',
        icon: Brain,
        description: 'Processing and analyzing data',
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200'
      },
      filtering: {
        label: 'Filtering',
        icon: Search,
        description: 'Filtering irrelevant data',
        color: 'bg-yellow-50 text-yellow-700 border-yellow-200'
      },
      gate_check: {
        label: 'Gate Check',
        icon: Shield,
        description: 'Quality gate verification',
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200'
      },
      complete: {
        label: 'Complete',
        icon: CheckCircle2,
        description: 'Processing finished',
        color: 'bg-green-50 text-green-700 border-green-200'
      },
      error: {
        label: 'Error',
        icon: AlertCircle,
        description: 'Processing failed',
        color: 'bg-red-50 text-red-700 border-red-200'
      },
      auditing_images: {
        label: 'Visual Audit',
        icon: Eye,
        description: 'Validating product images',
        color: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      finalizing: {
        label: 'Quality Check',
        icon: Target,
        description: 'Final validation and cleanup',
        color: 'bg-rose-50 text-rose-700 border-rose-200'
      },
    };

    const config = stepLabels[step || 'searching'];
    const Icon = config.icon;

    return (
      <div className="flex items-center gap-2">
        <span className={`${baseClasses} ${config.color} animate-pulse relative`}>
          <Icon size={12} className={Icon === Loader2 ? "animate-spin" : "animate-pulse"} strokeWidth={3} />
          {config.label}
          {showProgress && (
            <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-current opacity-30 rounded-full">
              <div className="h-full bg-current rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          )}
        </span>
        {processingTime && (
          <span className="text-[9px] text-slate-400 font-mono">
            {Math.round(processingTime / 1000)}s
          </span>
        )}
      </div>
    );
  }

  switch (status) {
    case 'ok':
      return (
        <div className="flex items-center gap-2">
          <span className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-100`}>
            <CheckCircle2 size={12} strokeWidth={3} /> Validated
          </span>
          {confidence !== undefined && (
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${confidence > 0.85 ? 'bg-emerald-500' :
                confidence > 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                }`}></div>
              <span className="text-[9px] text-slate-400 font-mono">
                {Math.round(confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      );
    case 'needs_review':
      return (
        <div className="flex items-center gap-2">
          <span className={`${baseClasses} bg-amber-50 text-amber-700 border-amber-100`}>
            <AlertCircle size={12} strokeWidth={3} /> Review Required
          </span>
          {errorCount && errorCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold rounded-full">
              {errorCount} issue{errorCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center gap-2">
          <span className={`${baseClasses} bg-rose-50 text-rose-700 border-rose-100`}>
            <XCircle size={12} strokeWidth={3} /> Failed
          </span>
          {errorCount && errorCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded-full">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      );
    default:
      return (
        <span className={`${baseClasses} bg-slate-100 text-slate-500 border-slate-200`}>
          <Clock size={12} strokeWidth={3} /> Pending
        </span>
      );
  }
};

export default StatusBadge;
