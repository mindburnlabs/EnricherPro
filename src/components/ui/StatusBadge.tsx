import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all",
  {
    variants: {
      variant: {
        pending: "bg-status-pending/10 text-status-pending border border-status-pending/20",
        verified: "bg-status-verified/10 text-status-verified border border-status-verified/20",
        conflict: "bg-status-conflict/10 text-status-conflict border border-status-conflict/20",
        locked: "bg-status-locked/10 text-status-locked border border-status-locked/20",
        failed: "bg-status-failed/10 text-status-failed border border-status-failed/20",
        running: "bg-status-running/10 text-status-running border border-status-running/20 animate-pulse-glow",
        ready: "bg-status-ready/10 text-status-ready border border-status-ready/20",
        completed: "bg-status-verified/10 text-status-verified border border-status-verified/20",
        needs_review: "bg-status-conflict/10 text-status-conflict border border-status-conflict/20",
        blocked: "bg-status-failed/10 text-status-failed border border-status-failed/20",
        ready_to_publish: "bg-status-ready/10 text-status-ready border border-status-ready/20",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        default: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "pending",
      size: "default",
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ 
  children, 
  variant, 
  size, 
  className,
  pulse 
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant, size }), pulse && "animate-pulse-glow", className)}>
      {(variant === 'running' || pulse) && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}
