import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Eye, ImageIcon } from "lucide-react";
import type { SKUData, FieldStatus } from "@/types/job";
import { cn } from "@/lib/utils";

interface SKUCardProps {
  data: SKUData;
  onViewEvidence: (fieldName: string) => void;
  onToggleLock: (fieldName: string) => void;
}

interface FieldRowProps {
  label: string;
  field: { value: string | number | null; status: FieldStatus; confidence?: number };
  fieldName: string;
  onViewEvidence: (fieldName: string) => void;
  onToggleLock: (fieldName: string) => void;
  mono?: boolean;
}

function FieldRow({ label, field, fieldName, onViewEvidence, onToggleLock, mono }: FieldRowProps) {
  return (
    <div className={cn(
      "group flex items-center justify-between py-3 px-4 -mx-4 rounded-lg transition-colors hover:bg-muted/50",
      field.status === 'conflict' && "bg-status-conflict/5"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <StatusBadge variant={field.status} size="sm">
            {field.status}
          </StatusBadge>
        </div>
        <div className={cn(
          "text-sm font-medium truncate",
          mono && "font-mono",
          !field.value && "text-muted-foreground italic"
        )}>
          {field.value ?? 'Not extracted'}
        </div>
        {field.confidence !== undefined && (
          <div className="mt-1.5 max-w-[150px]">
            <ConfidenceBar value={field.confidence} size="sm" />
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onViewEvidence(fieldName)}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToggleLock(fieldName)}
        >
          {field.status === 'locked' ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            <Unlock className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function SKUCard({ data, onViewEvidence, onToggleLock }: SKUCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Live SKU Card</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">{data.id}</span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-2">
        {/* Hero Image Preview */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-4">
          {data.heroImage ? (
            <>
              <img 
                src={data.heroImage.url} 
                alt="Product hero" 
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 right-2">
                <StatusBadge 
                  variant={
                    data.heroImage.qcStatus === 'approved' ? 'verified' :
                    data.heroImage.qcStatus === 'rejected' ? 'failed' : 'pending'
                  }
                  size="sm"
                >
                  QC: {data.heroImage.qcStatus}
                </StatusBadge>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <span className="text-xs">No image</span>
              </div>
            </div>
          )}
        </div>

        {/* Field Grid */}
        <div className="divide-y divide-border">
          <FieldRow 
            label="MPN" 
            field={data.mpn} 
            fieldName="mpn"
            onViewEvidence={onViewEvidence}
            onToggleLock={onToggleLock}
            mono
          />
          <FieldRow 
            label="Brand" 
            field={data.brand} 
            fieldName="brand"
            onViewEvidence={onViewEvidence}
            onToggleLock={onToggleLock}
          />
          <FieldRow 
            label="Yield" 
            field={data.yield} 
            fieldName="yield"
            onViewEvidence={onViewEvidence}
            onToggleLock={onToggleLock}
            mono
          />
          <FieldRow 
            label="Dimensions" 
            field={data.dimensions} 
            fieldName="dimensions"
            onViewEvidence={onViewEvidence}
            onToggleLock={onToggleLock}
            mono
          />
          <FieldRow 
            label="Weight" 
            field={data.weight} 
            fieldName="weight"
            onViewEvidence={onViewEvidence}
            onToggleLock={onToggleLock}
            mono
          />
        </div>
      </CardContent>
    </Card>
  );
}
