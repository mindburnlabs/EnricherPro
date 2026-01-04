import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { ExternalLink, ArrowRight, Merge, Edit3, AlertTriangle } from "lucide-react";
import type { ConflictData } from "@/types/job";
import { cn } from "@/lib/utils";

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictData | null;
  onResolve: (resolution: {
    fieldName: string;
    selectedValue: string;
    source: 'left' | 'right' | 'merge' | 'manual';
    reasoning?: string;
  }) => void;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflict,
  onResolve,
}: ConflictResolutionModalProps) {
  const [manualValue, setManualValue] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  if (!conflict || conflict.claims.length < 2) return null;

  const leftClaim = conflict.claims[0];
  const rightClaim = conflict.claims[1];
  const highestPriority = leftClaim.confidence >= rightClaim.confidence ? 'left' : 'right';

  const handleResolve = (source: 'left' | 'right' | 'merge' | 'manual') => {
    let selectedValue = '';
    
    if (source === 'left') selectedValue = leftClaim.value;
    else if (source === 'right') selectedValue = rightClaim.value;
    else if (source === 'merge') {
      // For numeric values, try to average
      const leftNum = parseFloat(leftClaim.value.replace(/[^\d.]/g, ''));
      const rightNum = parseFloat(rightClaim.value.replace(/[^\d.]/g, ''));
      if (!isNaN(leftNum) && !isNaN(rightNum)) {
        const avg = (leftNum + rightNum) / 2;
        const unit = leftClaim.value.replace(/[\d.]/g, '').trim();
        selectedValue = `${avg.toFixed(1)}${unit}`;
      } else {
        selectedValue = leftClaim.value; // fallback
      }
    } else {
      selectedValue = manualValue;
    }

    onResolve({
      fieldName: conflict.fieldName,
      selectedValue,
      source,
      reasoning: reasoning || undefined,
    });
    
    setManualValue("");
    setReasoning("");
    setShowManualEntry(false);
  };

  const isOverridingHighPriority = (source: 'left' | 'right') => {
    return (source === 'left' && highestPriority === 'right') ||
           (source === 'right' && highestPriority === 'left');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-conflict" />
            Conflicting Values Detected
          </DialogTitle>
          <DialogDescription>
            Multiple sources report different values for{" "}
            <Badge variant="secondary" className="font-mono">
              {conflict.fieldName.toUpperCase()}
            </Badge>
            . Please select which value to use.
          </DialogDescription>
        </DialogHeader>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Left Claim */}
          <div className={cn(
            "p-4 rounded-lg border-2 transition-all",
            highestPriority === 'left' 
              ? "border-status-verified bg-status-verified/5" 
              : "border-border bg-muted/30"
          )}>
            {highestPriority === 'left' && (
              <Badge className="mb-3 bg-status-verified/20 text-status-verified border-0">
                Highest Priority
              </Badge>
            )}
            
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Value
                </div>
                <div className="text-2xl font-mono font-bold">{leftClaim.value}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Source
                </div>
                <div className="text-sm">
                  <Badge variant="outline" className="font-normal">
                    {leftClaim.sourceType}
                  </Badge>
                </div>
                <a 
                  href={leftClaim.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  {leftClaim.sourceUrl.slice(0, 40)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Confidence
                </div>
                <ConfidenceBar value={leftClaim.confidence} />
              </div>
            </div>

            <Button
              className="w-full mt-4"
              variant={highestPriority === 'left' ? "default" : "outline"}
              onClick={() => handleResolve('left')}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Use This Value
            </Button>
          </div>

          {/* Right Claim */}
          <div className={cn(
            "p-4 rounded-lg border-2 transition-all",
            highestPriority === 'right' 
              ? "border-status-verified bg-status-verified/5" 
              : "border-border bg-muted/30"
          )}>
            {highestPriority === 'right' && (
              <Badge className="mb-3 bg-status-verified/20 text-status-verified border-0">
                Highest Priority
              </Badge>
            )}
            
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Value
                </div>
                <div className="text-2xl font-mono font-bold">{rightClaim.value}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Source
                </div>
                <div className="text-sm">
                  <Badge variant="outline" className="font-normal">
                    {rightClaim.sourceType}
                  </Badge>
                </div>
                <a 
                  href={rightClaim.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  {rightClaim.sourceUrl.slice(0, 40)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Confidence
                </div>
                <ConfidenceBar value={rightClaim.confidence} />
              </div>
            </div>

            <Button
              className="w-full mt-4"
              variant={highestPriority === 'right' ? "default" : "outline"}
              onClick={() => handleResolve('right')}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Use This Value
            </Button>
          </div>
        </div>

        {/* Alternative Actions */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleResolve('merge')}
              className="gap-2"
            >
              <Merge className="w-4 h-4" />
              Merge Values (Average)
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Manual Entry
            </Button>
          </div>

          {showManualEntry && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg animate-fade-in">
              <div>
                <label className="text-sm font-medium">Custom Value</label>
                <input
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="Enter your value..."
                  className="mt-1 w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Reasoning <span className="text-muted-foreground">(required when overriding)</span>
                </label>
                <Textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Explain why you're overriding the detected values..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <Button
                onClick={() => handleResolve('manual')}
                disabled={!manualValue.trim() || !reasoning.trim()}
              >
                Apply Manual Value
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
