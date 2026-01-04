import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Job, JobStatus } from "@/types/job";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";

interface JobTableProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  selectedJobId?: string;
}

const statusLabels: Record<JobStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  needs_review: 'Needs Review',
  blocked: 'Blocked',
  ready_to_publish: 'Ready to Publish',
};

export function JobTable({ jobs, onSelectJob, selectedJobId }: JobTableProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[300px]">Input String</TableHead>
            <TableHead className="font-mono">MPN</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Timestamp</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              onClick={() => onSelectJob(job)}
              className={`cursor-pointer transition-colors ${
                selectedJobId === job.id 
                  ? 'bg-primary/5 hover:bg-primary/10' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <TableCell className="max-w-[300px] truncate font-medium">
                {job.inputString}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {job.mpn || '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {job.brand || '—'}
              </TableCell>
              <TableCell>
                <StatusBadge variant={job.status}>
                  {statusLabels[job.status]}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(job.createdAt, { addSuffix: true })}
              </TableCell>
              <TableCell>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
          {jobs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No jobs found. Create your first enrichment job above.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
