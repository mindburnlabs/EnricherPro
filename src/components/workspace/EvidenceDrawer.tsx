import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Shield, ShieldCheck, Clock, FileText, Globe, ShoppingCart, MessageSquare } from "lucide-react";
import type { Evidence } from "@/types/job";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
  evidence: Evidence[];
  onVerifyHash: (evidenceId: string) => void;
}

const sourceIcons: Record<Evidence['sourceType'], React.ReactNode> = {
  official: <Globe className="w-4 h-4" />,
  marketplace: <ShoppingCart className="w-4 h-4" />,
  forum: <MessageSquare className="w-4 h-4" />,
  datasheet: <FileText className="w-4 h-4" />,
};

const sourceLabels: Record<Evidence['sourceType'], string> = {
  official: 'Official Site',
  marketplace: 'Marketplace',
  forum: 'Forum',
  datasheet: 'Datasheet',
};

const sourcePriority: Record<Evidence['sourceType'], number> = {
  official: 1,
  datasheet: 2,
  marketplace: 3,
  forum: 4,
};

export function EvidenceDrawer({ 
  isOpen, 
  onClose, 
  fieldName, 
  evidence,
  onVerifyHash 
}: EvidenceDrawerProps) {
  const sortedEvidence = [...evidence].sort((a, b) => {
    // Sort by priority score first, then by source type priority
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return sourcePriority[a.sourceType] - sourcePriority[b.sourceType];
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Evidence for{' '}
            <Badge variant="secondary" className="font-mono">
              {fieldName.toUpperCase()}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto scrollbar-thin pr-2" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {sortedEvidence.map((item, index) => (
            <Card 
              key={item.id}
              className={cn(
                "transition-all animate-slide-in-up",
                index === 0 && "ring-2 ring-primary/20 bg-primary/5"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      item.sourceType === 'official' ? "bg-chart-3/10 text-chart-3" :
                      item.sourceType === 'datasheet' ? "bg-chart-2/10 text-chart-2" :
                      item.sourceType === 'marketplace' ? "bg-chart-4/10 text-chart-4" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {sourceIcons[item.sourceType]}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{sourceLabels[item.sourceType]}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                        {item.sourceUrl}
                      </div>
                    </div>
                  </div>
                  {item.verified && (
                    <ShieldCheck className="w-5 h-5 text-status-verified" />
                  )}
                </div>

                {/* Value */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Extracted Value</div>
                  <div className="font-mono font-medium">{item.value}</div>
                </div>

                {/* Snippet */}
                <div className="text-sm text-muted-foreground italic">
                  "{item.snippet}"
                </div>

                {/* Confidence */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Confidence Score</span>
                    <span className="font-mono">{item.confidence}/100</span>
                  </div>
                  <ConfidenceBar value={item.confidence} showLabel={false} size="md" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(item.fetchedAt, { addSuffix: true })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={() => onVerifyHash(item.id)}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Verify Hash
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      asChild
                    >
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {evidence.length === 0 && (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No evidence found for this field</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
