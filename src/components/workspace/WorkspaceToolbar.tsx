import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pause, Square, Clock, Coins, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceToolbarProps {
  cost: number;
  costLimit: number;
  duration: number;
  durationLimit: number;
  onPause: () => void;
  onStop: () => void;
  isPaused?: boolean;
}

export function WorkspaceToolbar({ 
  cost, 
  costLimit, 
  duration, 
  durationLimit,
  onPause,
  onStop,
  isPaused 
}: WorkspaceToolbarProps) {
  const costPercent = (cost / costLimit) * 100;
  const durationPercent = (duration / durationLimit) * 100;
  const isNearLimit = costPercent > 80 || durationPercent > 80;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={cn(
      "border-0 shadow-lg",
      isNearLimit && "ring-2 ring-status-conflict/50"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Cost Monitor */}
            <div className="flex items-center gap-2">
              <Coins className={cn(
                "w-4 h-4",
                costPercent > 80 ? "text-status-conflict" : "text-muted-foreground"
              )} />
              <div className="text-sm">
                <span className="font-mono font-medium">
                  ${cost.toFixed(3)}
                </span>
                <span className="text-muted-foreground">
                  {' / '}${costLimit.toFixed(2)}
                </span>
              </div>
              {costPercent > 80 && (
                <AlertTriangle className="w-3.5 h-3.5 text-status-conflict animate-pulse" />
              )}
            </div>

            {/* Duration Monitor */}
            <div className="flex items-center gap-2">
              <Clock className={cn(
                "w-4 h-4",
                durationPercent > 80 ? "text-status-conflict" : "text-muted-foreground"
              )} />
              <div className="text-sm">
                <span className="font-mono font-medium">
                  {formatDuration(duration)}
                </span>
                <span className="text-muted-foreground">
                  {' / '}{formatDuration(durationLimit)}
                </span>
              </div>
              {durationPercent > 80 && (
                <AlertTriangle className="w-3.5 h-3.5 text-status-conflict animate-pulse" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPause}
              className="h-8 gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" />
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onStop}
              className="h-8 gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
