
import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Clock, Loader2, Search, Database, Brain, Sparkles } from 'lucide-react';
import { ValidationStatus, ProcessingStep } from '../types';

interface StatusBadgeProps {
  status: ValidationStatus;
  step?: ProcessingStep;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, step }) => {
  const baseClasses = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-all";
  
  if (status === 'processing') {
    const stepLabels: Record<ProcessingStep, { label: string, icon: any }> = {
      idle: { label: 'Waiting', icon: Clock },
      searching: { label: 'Grounding Search', icon: Search },
      scraping_nix: { label: 'Scraping Nix.ru', icon: Database },
      scraping_compat: { label: 'Syncing Compat', icon: Database },
      analyzing: { label: 'AI Synthesis', icon: Brain },
      auditing_images: { label: 'Auditing Assets', icon: Sparkles },
      finalizing: { label: 'Finalizing', icon: Loader2 },
    };
    
    const config = stepLabels[step || 'searching'];
    const Icon = config.icon;

    return (
      <span className={`${baseClasses} bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse`}>
        <Icon size={12} className={Icon === Loader2 ? "animate-spin" : ""} strokeWidth={3} /> {config.label}
      </span>
    );
  }

  switch (status) {
    case 'ok':
      return (
        <span className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-100`}>
          <CheckCircle2 size={12} strokeWidth={3} /> Validated
        </span>
      );
    case 'needs_review':
      return (
        <span className={`${baseClasses} bg-amber-50 text-amber-700 border-amber-100`}>
          <AlertCircle size={12} strokeWidth={3} /> Review
        </span>
      );
    case 'failed':
      return (
        <span className={`${baseClasses} bg-rose-50 text-rose-700 border-rose-100`}>
          <XCircle size={12} strokeWidth={3} /> Failed
        </span>
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
