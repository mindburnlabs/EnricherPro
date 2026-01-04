import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Filter, 
  Lock, 
  Edit3, 
  GitMerge, 
  ArrowRight,
  Clock,
  User,
  FileText
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: 'field_lock' | 'manual_override' | 'conflict_resolution' | 'agent_update';
  fieldName: string;
  beforeValue: string | null;
  afterValue: string;
  userId?: string;
  reasoning?: string;
  source?: string;
  jobId: string;
}

interface AuditLogViewProps {
  entries: AuditEntry[];
  onFilterChange?: (filter: string) => void;
}

const actionIcons = {
  field_lock: Lock,
  manual_override: Edit3,
  conflict_resolution: GitMerge,
  agent_update: FileText,
};

const actionLabels = {
  field_lock: 'Field Locked',
  manual_override: 'Manual Override',
  conflict_resolution: 'Conflict Resolved',
  agent_update: 'Agent Update',
};

const actionColors = {
  field_lock: 'bg-status-locked/10 text-status-locked',
  manual_override: 'bg-status-conflict/10 text-status-conflict',
  conflict_resolution: 'bg-status-ready/10 text-status-ready',
  agent_update: 'bg-status-verified/10 text-status-verified',
};

export function AuditLogView({ entries, onFilterChange }: AuditLogViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      entry.fieldName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.afterValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.beforeValue?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesAction = !selectedAction || entry.action === selectedAction;
    
    return matchesSearch && matchesAction;
  });

  const groupedByDate = filteredEntries.reduce((acc, entry) => {
    const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, AuditEntry[]>);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by field name or value..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {Object.entries(actionLabels).map(([key, label]) => (
                <Button
                  key={key}
                  variant={selectedAction === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAction(selectedAction === key ? null : key)}
                  className="text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Audit Timeline
          </CardTitle>
          <CardDescription>
            Complete history of all data modifications with before/after values
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {Object.entries(groupedByDate).map(([date, dayEntries]) => (
              <div key={date} className="mb-6">
                <div className="sticky top-0 bg-card z-10 py-2 mb-3 border-b">
                  <span className="text-sm font-medium text-muted-foreground">
                    {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {dayEntries.map((entry, idx) => {
                    const Icon = actionIcons[entry.action];
                    return (
                      <div 
                        key={entry.id}
                        className="flex gap-4 animate-fade-in"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        {/* Timeline Line */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            actionColors[entry.action]
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {idx < dayEntries.length - 1 && (
                            <div className="w-px h-full bg-border min-h-[40px]" />
                          )}
                        </div>

                        {/* Entry Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {entry.fieldName.toUpperCase()}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", actionColors[entry.action])}
                            >
                              {actionLabels[entry.action]}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(entry.timestamp, 'HH:mm:ss')}
                            </span>
                          </div>

                          {/* Before/After Values */}
                          <div className="flex items-center gap-3 mt-2 p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground mb-1">Before</div>
                              <div className={cn(
                                "font-mono text-sm",
                                !entry.beforeValue && "text-muted-foreground italic"
                              )}>
                                {entry.beforeValue || 'Empty'}
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground mb-1">After</div>
                              <div className="font-mono text-sm font-medium">
                                {entry.afterValue}
                              </div>
                            </div>
                          </div>

                          {/* Additional Info */}
                          {(entry.reasoning || entry.source) && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {entry.reasoning && (
                                <p className="italic">"{entry.reasoning}"</p>
                              )}
                              {entry.source && (
                                <p className="flex items-center gap-1 mt-1">
                                  Source: <span className="font-mono">{entry.source}</span>
                                </p>
                              )}
                            </div>
                          )}

                          {entry.userId && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              {entry.userId}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredEntries.length === 0 && (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No audit entries found</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(actionLabels).map(([key, label]) => {
          const count = entries.filter(e => e.action === key).length;
          const Icon = actionIcons[key as keyof typeof actionIcons];
          return (
            <Card key={key}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    actionColors[key as keyof typeof actionColors]
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
