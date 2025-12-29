import React from 'react';
import { Shield, Target, Zap } from 'lucide-react';

interface ConfidenceIndicatorProps {
  confidence?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  label,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  if (confidence === undefined) return null;

  const percentage = Math.round(confidence * 100);
  const isHigh = confidence > 0.85;
  const isMed = confidence > 0.6;

  // Semantic SOTA Colors
  const colorClasses = isHigh
    ? { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', shadow: 'shadow-emerald-500/20' }
    : isMed
      ? { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', shadow: 'shadow-amber-500/20' }
      : { text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10', shadow: 'shadow-red-500/20' };

  const sizeClasses = {
    sm: { padding: 'px-2 py-0.5', fontSize: 'text-[9px]', iconSize: 10, gap: 'gap-1.5' },
    md: { padding: 'px-3 py-1', fontSize: 'text-[10px]', iconSize: 12, gap: 'gap-2' },
    lg: { padding: 'px-4 py-1.5', fontSize: 'text-xs', iconSize: 14, gap: 'gap-2.5' }
  };

  const Icon = isHigh ? Shield : isMed ? Target : Zap;
  const currentSize = sizeClasses[size];

  return (
    <div className={`flex items-center ${currentSize.gap} ${currentSize.padding} border rounded-xl backdrop-blur-sm transition-all duration-300 group hover:scale-105 ${colorClasses.bg} ${colorClasses.border} ${className}`}>
      {showIcon && (
        <div className={`relative ${colorClasses.text}`}>
          <Icon size={currentSize.iconSize} />
          <div className={`absolute inset-0 blur-sm opacity-50 ${colorClasses.text} group-hover:opacity-100 transition-opacity`}>
            <Icon size={currentSize.iconSize} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {label && (
          <span className={`${currentSize.fontSize} font-black uppercase tracking-widest text-primary-subtle opacity-80 group-hover:opacity-100 transition-opacity`}>
            {label}:
          </span>
        )}
        <span className={`${currentSize.fontSize} font-mono font-black ${colorClasses.text} tracking-wider shadow-[0_0_10px_transparent] group-hover:${colorClasses.shadow} transition-all`}>
          {percentage}%
        </span>
      </div>
    </div>
  );
};

export default ConfidenceIndicator;