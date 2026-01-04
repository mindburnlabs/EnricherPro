import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Coins, Zap, Activity } from "lucide-react";
import type { BudgetData } from "@/types/job";
import { cn } from "@/lib/utils";

interface BudgetWidgetProps {
  data: BudgetData;
}

export function BudgetWidget({ data }: BudgetWidgetProps) {
  const tokenPercent = (data.tokenUsage / data.tokenLimit) * 100;
  const costPercent = (data.estimatedCost / data.costLimit) * 100;
  const apiPercent = (data.apiCalls / data.apiCallLimit) * 100;

  const isWarning = tokenPercent > 80 || costPercent > 80;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all",
      isWarning && "border-status-conflict/50 shadow-[0_0_15px_hsl(var(--status-conflict)/0.1)]"
    )}>
      {isWarning && (
        <div className="absolute top-3 right-3">
          <AlertTriangle className="w-4 h-4 text-status-conflict animate-pulse" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Budget Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-chart-2" />
              <span className="text-muted-foreground">Tokens</span>
            </div>
            <span className="font-mono text-xs">
              {data.tokenUsage.toLocaleString()} / {data.tokenLimit.toLocaleString()}
            </span>
          </div>
          <Progress 
            value={tokenPercent} 
            className="h-1.5"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-chart-3" />
              <span className="text-muted-foreground">Cost</span>
            </div>
            <span className="font-mono text-xs">
              ${data.estimatedCost.toFixed(2)} / ${data.costLimit.toFixed(2)}
            </span>
          </div>
          <Progress 
            value={costPercent} 
            className="h-1.5"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-chart-1" />
              <span className="text-muted-foreground">API Calls</span>
            </div>
            <span className="font-mono text-xs">
              {data.apiCalls} / {data.apiCallLimit}
            </span>
          </div>
          <Progress 
            value={apiPercent} 
            className="h-1.5"
          />
        </div>
      </CardContent>
    </Card>
  );
}
