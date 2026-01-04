import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  GripVertical, 
  Save, 
  RotateCcw,
  DollarSign,
  Zap,
  Clock,
  Brain,
  FileText,
  Globe,
  ShoppingCart,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SourcePriority {
  id: string;
  name: string;
  type: 'official' | 'datasheet' | 'marketplace' | 'forum';
  priority: number;
  enabled: boolean;
}

interface BudgetCaps {
  maxSpendPerSKU: number;
  maxTokensPerSKU: number;
  maxExecutionTime: number;
  globalDailyBudget: number;
}

interface LLMSettings {
  orchestratorModel: string;
  subAgentModel: string;
  enableStreaming: boolean;
  temperature: number;
}

export interface SystemConfig {
  sourcePriorities: SourcePriority[];
  budgetCaps: BudgetCaps;
  llmSettings: LLMSettings;
}

interface ConfigurationPanelProps {
  config: SystemConfig;
  onSave: (config: SystemConfig) => void;
}

const sourceIcons = {
  official: Globe,
  datasheet: FileText,
  marketplace: ShoppingCart,
  forum: MessageSquare,
};

const defaultConfig: SystemConfig = {
  sourcePriorities: [
    { id: '1', name: 'Official Manufacturer Sites', type: 'official', priority: 1, enabled: true },
    { id: '2', name: 'PDF Datasheets', type: 'datasheet', priority: 2, enabled: true },
    { id: '3', name: 'Marketplace Listings', type: 'marketplace', priority: 3, enabled: true },
    { id: '4', name: 'Forum Discussions', type: 'forum', priority: 4, enabled: true },
  ],
  budgetCaps: {
    maxSpendPerSKU: 0.50,
    maxTokensPerSKU: 50000,
    maxExecutionTime: 600,
    globalDailyBudget: 50.00,
  },
  llmSettings: {
    orchestratorModel: 'claude-sonnet-4-5',
    subAgentModel: 'gemini-2.5-flash',
    enableStreaming: true,
    temperature: 0.3,
  },
};

export function ConfigurationPanel({ config = defaultConfig, onSave }: ConfigurationPanelProps) {
  const [localConfig, setLocalConfig] = useState<SystemConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const updateConfig = <K extends keyof SystemConfig>(
    section: K,
    updates: Partial<SystemConfig[K]>
  ) => {
    setLocalConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
    setHasChanges(true);
  };

  const updateSourcePriority = (id: string, updates: Partial<SourcePriority>) => {
    setLocalConfig(prev => ({
      ...prev,
      sourcePriorities: prev.sourcePriorities.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localConfig);
    setHasChanges(false);
    toast.success('Configuration saved successfully');
  };

  const handleReset = () => {
    setLocalConfig(defaultConfig);
    setHasChanges(true);
    toast.info('Configuration reset to defaults');
  };

  const moveSource = (fromIndex: number, toIndex: number) => {
    const newPriorities = [...localConfig.sourcePriorities];
    const [removed] = newPriorities.splice(fromIndex, 1);
    newPriorities.splice(toIndex, 0, removed);
    
    // Update priority numbers
    const updated = newPriorities.map((s, i) => ({ ...s, priority: i + 1 }));
    
    setLocalConfig(prev => ({ ...prev, sourcePriorities: updated }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage agent behavior, source priorities, and budget limits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges} className="gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Source Priority Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Source Priority Rankings
          </CardTitle>
          <CardDescription>
            Drag to reorder. Higher priority sources are trusted more during conflict resolution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {localConfig.sourcePriorities
              .sort((a, b) => a.priority - b.priority)
              .map((source, index) => {
                const Icon = sourceIcons[source.type];
                return (
                  <div
                    key={source.id}
                    draggable
                    onDragStart={() => setDraggedItem(source.id)}
                    onDragEnd={() => setDraggedItem(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedItem) {
                        const fromIndex = localConfig.sourcePriorities.findIndex(s => s.id === draggedItem);
                        moveSource(fromIndex, index);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border bg-card transition-all cursor-grab active:cursor-grabbing",
                      draggedItem === source.id && "opacity-50 scale-[0.98]",
                      !source.enabled && "opacity-60"
                    )}
                  >
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                    <Badge className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                      {source.priority}
                    </Badge>
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      source.type === 'official' ? "bg-chart-3/10 text-chart-3" :
                      source.type === 'datasheet' ? "bg-chart-2/10 text-chart-2" :
                      source.type === 'marketplace' ? "bg-chart-4/10 text-chart-4" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{source.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{source.type}</div>
                    </div>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={(enabled) => updateSourcePriority(source.id, { enabled })}
                    />
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Budget Caps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Budget Caps
          </CardTitle>
          <CardDescription>
            Set spending limits to control costs and prevent runaway jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Max Spend per SKU
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5.00"
                  value={localConfig.budgetCaps.maxSpendPerSKU}
                  onChange={(e) => updateConfig('budgetCaps', { 
                    maxSpendPerSKU: parseFloat(e.target.value) 
                  })}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">Job stops if cost exceeds this limit</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Max Tokens per SKU
              </Label>
              <Input
                type="number"
                step="5000"
                min="10000"
                max="500000"
                value={localConfig.budgetCaps.maxTokensPerSKU}
                onChange={(e) => updateConfig('budgetCaps', { 
                  maxTokensPerSKU: parseInt(e.target.value) 
                })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Maximum tokens consumed per job</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Max Execution Time (seconds)
              </Label>
              <Input
                type="number"
                step="60"
                min="60"
                max="3600"
                value={localConfig.budgetCaps.maxExecutionTime}
                onChange={(e) => updateConfig('budgetCaps', { 
                  maxExecutionTime: parseInt(e.target.value) 
                })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Job times out after this duration</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Global Daily Budget
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="5"
                  min="10"
                  max="500"
                  value={localConfig.budgetCaps.globalDailyBudget}
                  onChange={(e) => updateConfig('budgetCaps', { 
                    globalDailyBudget: parseFloat(e.target.value) 
                  })}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">Total daily spending limit across all jobs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LLM Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5" />
            LLM Provider Settings
          </CardTitle>
          <CardDescription>
            Configure which models power the agent orchestrator and sub-agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Orchestrator Model</Label>
              <Select
                value={localConfig.llmSettings.orchestratorModel}
                onValueChange={(value) => updateConfig('llmSettings', { orchestratorModel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommended)</SelectItem>
                  <SelectItem value="claude-opus-4-5">Claude Opus 4.5 (Most Capable)</SelectItem>
                  <SelectItem value="gpt-5">GPT-5</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Primary model for task planning and coordination</p>
            </div>

            <div className="space-y-2">
              <Label>Sub-Agent Model</Label>
              <Select
                value={localConfig.llmSettings.subAgentModel}
                onValueChange={(value) => updateConfig('llmSettings', { subAgentModel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</SelectItem>
                  <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</SelectItem>
                  <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                  <SelectItem value="claude-haiku">Claude Haiku</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Cost-effective model for specialized extraction tasks</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Streaming</Label>
                <p className="text-xs text-muted-foreground">Show real-time agent responses</p>
              </div>
              <Switch
                checked={localConfig.llmSettings.enableStreaming}
                onCheckedChange={(enableStreaming) => 
                  updateConfig('llmSettings', { enableStreaming })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperature: {localConfig.llmSettings.temperature}</Label>
              </div>
              <Slider
                value={[localConfig.llmSettings.temperature]}
                onValueChange={([temperature]) => 
                  updateConfig('llmSettings', { temperature })
                }
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precise (0)</span>
                <span>Creative (1)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg border-primary/20 bg-card/95 backdrop-blur">
            <CardContent className="py-3 px-4 flex items-center gap-4">
              <span className="text-sm">You have unsaved changes</span>
              <Button size="sm" onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" />
                Save
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
