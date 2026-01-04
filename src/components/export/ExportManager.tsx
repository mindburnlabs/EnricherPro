import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Eye, 
  Bot,
  FileCode,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ValidationBlocker {
  id: string;
  channel: 'ozon' | 'yandex' | 'wildberries';
  severity: 'critical' | 'warning';
  message: string;
  field?: string;
  canAutoFix: boolean;
}

interface ExportManagerProps {
  skuId: string;
  blockers: ValidationBlocker[];
  onRequestFix: (blockerId: string) => void;
  onExport: (format: 'ozon_xml' | 'yandex_yml' | 'wildberries_csv') => void;
  onPublish: () => void;
}

const channelInfo = {
  ozon: { name: 'Ozon', color: 'bg-blue-500', format: 'XML' },
  yandex: { name: 'Yandex Market', color: 'bg-red-500', format: 'YML' },
  wildberries: { name: 'Wildberries', color: 'bg-purple-500', format: 'CSV' },
};

export function ExportManager({ 
  skuId, 
  blockers, 
  onRequestFix, 
  onExport, 
  onPublish 
}: ExportManagerProps) {
  const [expandedChannel, setExpandedChannel] = useState<string | null>('ozon');
  const [previewFormat, setPreviewFormat] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const criticalBlockers = blockers.filter(b => b.severity === 'critical');
  const canPublish = criticalBlockers.length === 0;

  const blockersByChannel = blockers.reduce((acc, blocker) => {
    if (!acc[blocker.channel]) acc[blocker.channel] = [];
    acc[blocker.channel].push(blocker);
    return acc;
  }, {} as Record<string, ValidationBlocker[]>);

  const handleExport = async (format: 'ozon_xml' | 'yandex_yml' | 'wildberries_csv') => {
    setIsExporting(true);
    try {
      await onExport(format);
      toast.success(`Exported ${format.toUpperCase()} file successfully`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = (format: string) => {
    setPreviewFormat(previewFormat === format ? null : format);
  };

  return (
    <div className="space-y-6">
      {/* Channel Validation Gates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-status-conflict" />
            Channel Validation Gates
          </CardTitle>
          <CardDescription>
            Resolve all critical blockers before publishing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(['ozon', 'yandex', 'wildberries'] as const).map((channel) => {
            const channelBlockers = blockersByChannel[channel] || [];
            const hasCritical = channelBlockers.some(b => b.severity === 'critical');
            const isExpanded = expandedChannel === channel;

            return (
              <div 
                key={channel}
                className={cn(
                  "border rounded-lg overflow-hidden transition-all",
                  hasCritical ? "border-status-failed/30" : "border-status-verified/30"
                )}
              >
                <button
                  onClick={() => setExpandedChannel(isExpanded ? null : channel)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center justify-between transition-colors",
                    hasCritical ? "bg-status-failed/5 hover:bg-status-failed/10" : "bg-status-verified/5 hover:bg-status-verified/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", channelInfo[channel].color)} />
                    <span className="font-medium">{channelInfo[channel].name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {channelInfo[channel].format}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasCritical ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {channelBlockers.filter(b => b.severity === 'critical').length} blockers
                      </Badge>
                    ) : (
                      <Badge className="bg-status-verified/20 text-status-verified border-0 gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && channelBlockers.length > 0 && (
                  <div className="border-t bg-background">
                    {channelBlockers.map((blocker) => (
                      <div 
                        key={blocker.id}
                        className="px-4 py-3 flex items-center justify-between border-b last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          {blocker.severity === 'critical' ? (
                            <AlertCircle className="w-4 h-4 text-status-failed shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-status-conflict shrink-0" />
                          )}
                          <div>
                            <p className="text-sm">{blocker.message}</p>
                            {blocker.field && (
                              <span className="text-xs text-muted-foreground font-mono">
                                Field: {blocker.field}
                              </span>
                            )}
                          </div>
                        </div>
                        {blocker.canAutoFix && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRequestFix(blocker.id)}
                            className="gap-1.5 shrink-0"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Ask Agent to Fix
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && channelBlockers.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground border-t bg-background">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-status-verified" />
                    All validation checks passed for {channelInfo[channel].name}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Multi-Channel Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Multi-Channel Export
          </CardTitle>
          <CardDescription>
            Export product data in marketplace-specific formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ozon">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ozon" className="gap-2">
                <FileCode className="w-4 h-4" />
                Ozon XML
              </TabsTrigger>
              <TabsTrigger value="yandex" className="gap-2">
                <FileText className="w-4 h-4" />
                Yandex YML
              </TabsTrigger>
              <TabsTrigger value="wildberries" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Wildberries CSV
              </TabsTrigger>
            </TabsList>

            {(['ozon', 'yandex', 'wildberries'] as const).map((channel) => {
              const formatKey = `${channel}_${channelInfo[channel].format.toLowerCase()}` as any;
              return (
                <TabsContent key={channel} value={channel} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handlePreview(channel)}
                      className="gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {previewFormat === channel ? 'Hide' : 'Dry Run'} Preview
                    </Button>
                    <Button
                      onClick={() => handleExport(formatKey)}
                      disabled={isExporting}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download {channelInfo[channel].format}
                    </Button>
                  </div>

                  {previewFormat === channel && (
                    <ScrollArea className="h-[200px] w-full rounded-lg border bg-muted/50 p-4">
                      <pre className="text-xs font-mono text-muted-foreground">
                        {channel === 'ozon' && `<?xml version="1.0" encoding="UTF-8"?>
<product>
  <sku>${skuId}</sku>
  <mpn>CE285A</mpn>
  <brand>HP</brand>
  <name>HP 85A Black Original LaserJet Toner</name>
  <yield>1600</yield>
  <weight>0.45</weight>
  <dimensions>
    <length>12.5</length>
    <width>3.8</width>
    <height>5.2</height>
  </dimensions>
  <images>
    <image type="hero">https://...</image>
  </images>
</product>`}
                        {channel === 'yandex' && `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2024-01-15">
  <shop>
    <offers>
      <offer id="${skuId}">
        <name>HP 85A Black Original LaserJet Toner</name>
        <vendor>HP</vendor>
        <vendorCode>CE285A</vendorCode>
        <param name="Ресурс">1600 страниц</param>
        <param name="Вес">0.45 кг</param>
        <picture>https://...</picture>
      </offer>
    </offers>
  </shop>
</yml_catalog>`}
                        {channel === 'wildberries' && `"SKU","MPN","Brand","Name","Yield","Weight","Length","Width","Height","Image URL"
"${skuId}","CE285A","HP","HP 85A Black Original LaserJet Toner","1600","0.45","12.5","3.8","5.2","https://..."`}
                      </pre>
                    </ScrollArea>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Publish Action */}
      <Card className={cn(
        "border-2 transition-all",
        canPublish 
          ? "border-status-verified/50 bg-status-verified/5" 
          : "border-status-failed/30 bg-status-failed/5"
      )}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {canPublish ? 'Ready to Publish' : 'Cannot Publish'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {canPublish 
                  ? 'All critical validation gates have been passed' 
                  : `${criticalBlockers.length} critical blocker(s) must be resolved first`}
              </p>
            </div>
            <Button
              size="lg"
              disabled={!canPublish}
              onClick={onPublish}
              className="gap-2"
            >
              <Upload className="w-5 h-5" />
              Publish to All Channels
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
