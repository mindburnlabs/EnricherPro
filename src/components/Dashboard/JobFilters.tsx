import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/types/job";
import { cn } from "@/lib/utils";

interface JobFiltersProps {
  activeFilter: JobStatus | 'all';
  onFilterChange: (filter: JobStatus | 'all') => void;
  counts: Record<JobStatus | 'all', number>;
}

const filters: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Jobs' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'ready_to_publish', label: 'Ready to Publish' },
];

export function JobFilters({ activeFilter, onFilterChange, counts }: JobFiltersProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            "h-8 px-3 text-xs font-medium transition-all",
            activeFilter === filter.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {filter.label}
          {counts[filter.value] > 0 && (
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full",
              activeFilter === filter.value
                ? "bg-primary/10 text-primary"
                : "bg-muted-foreground/10"
            )}>
              {counts[filter.value]}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
