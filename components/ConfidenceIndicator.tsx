import React from 'react';
import { Shield, Target, Zap, TrendingUp } from 'lucide-react';

interface ConfidenceIndicatorProps {
  confidence?: number;
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'dot' | 'bar' | 'badge' | 'detailed';
  showIcon?: boolean;
  className?: string;
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  label,
  size = 'sm',
  variant = 'dot',
  showIcon = false,
  className = ''
}) => {
  if (confidence === undefined) return null;

  const sizeClasses = {
    xs: { dot: 'w-1.5 h-1.5', text: 'text-[8px]', padding: 'px-1 py-0.5', icon: 8 },
    sm: { dot: 'w-2 h-2', text: 'text-[9px]', padding: 'px-2 py-1', icon: 10 },
    md: { dot: 'w-3 h-3', text: 'text-[10px]', padding: 'px-2 py-1', icon: 12 },
    lg: { dot: 'w-4 h-4', text: 'text-xs', padding: 'px-3 py-1.5', icon: 14 }
  };

  const isHigh = confidence > 0.85;
  const isMed = confidence > 0.6;
  const isLow = confidence <= 0.6;

  const colorClasses = {
    dot: isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-500' : 'bg-rose-500',
    bg: isHigh ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
        isMed ? 'bg-amber-50 border-amber-200 text-amber-700' : 
        'bg-rose-50 border-rose-200 text-rose-700',
    text: isHigh ? 'text-emerald-600' : isMed ? 'text-amber-600' : 'text-rose-600'
  };

  const getIcon = () => {
    if (isHigh) return Shield;
    if (isMed) return Target;
    return Zap;
  };

  const Icon = getIcon();
  const percentage = Math.round(confidence * 100);

  switch (variant) {
    case 'bar':
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          {label && (
            <span className={`${sizeClasses[size].text} font-bold text-slate-500 uppercase tracking-wider`}>
              {label}:
            </span>
          )}
          <div className="flex items-center gap-1">
            <div className="w-12 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${colorClasses.dot}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className={`${sizeClasses[size].text} font-mono text-slate-600`}>
              {percentage}%
            </span>
          </div>
        </div>
      );

    case 'badge':
      return (
        <div className={`inline-flex items-center gap-1 ${sizeClasses[size].padding} ${colorClasses.bg} border rounded-lg ${className}`}>
          {showIcon && <Icon size={sizeClasses[size].icon} />}
          <span className={`${sizeClasses[size].text} font-bold uppercase tracking-wider`}>
            {label ? `${label}: ` : ''}{percentage}%
          </span>
        </div>
      );

    case 'detailed':
      return (
        <div className={`flex items-center gap-2 p-2 ${colorClasses.bg} border rounded-lg ${className}`}>
          <Icon size={sizeClasses[size].icon} />
          <div>
            {label && (
              <div className={`${sizeClasses[size].text} font-bold uppercase tracking-wider opacity-75`}>
                {label}
              </div>
            )}
            <div className={`text-sm font-black ${colorClasses.text}`}>
              {percentage}%
            </div>
          </div>
        </div>
      );

    default: // dot
      return (
        <div className={`flex items-center gap-1 ${className}`}>
          <div className={`${sizeClasses[size].dot} rounded-full ${colorClasses.dot}`}></div>
          {label && (
            <span className={`${sizeClasses[size].text} font-bold text-slate-500 uppercase tracking-wider`}>
              {label}: {percentage}%
            </span>
          )}
          {!label && (
            <span className={`${sizeClasses[size].text} font-mono text-slate-400`}>
              {percentage}%
            </span>
          )}
        </div>
      );
  }
};

export default ConfidenceIndicator;