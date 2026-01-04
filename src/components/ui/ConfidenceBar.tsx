import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceBar({ 
  value, 
  showLabel = true, 
  size = 'md',
  className 
}: ConfidenceBarProps) {
  const getColorClass = (val: number) => {
    if (val >= 80) return 'bg-confidence-high';
    if (val >= 50) return 'bg-confidence-medium';
    return 'bg-confidence-low';
  };

  const heights = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "flex-1 rounded-full bg-muted overflow-hidden",
        heights[size]
      )}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            getColorClass(value)
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn(
          "font-mono text-muted-foreground tabular-nums",
          size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'
        )}>
          {value}%
        </span>
      )}
    </div>
  );
}
