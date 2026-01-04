import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Upload, Sparkles } from "lucide-react";

interface CreateJobFormProps {
  onCreateJob: (input: string) => void;
  onBulkUpload: () => void;
}

export function CreateJobForm({ onCreateJob, onBulkUpload }: CreateJobFormProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onCreateJob(input.trim());
      setInput("");
    }
  };

  return (
    <Card className="border-dashed border-2 bg-gradient-to-br from-card to-muted/30">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Enter a supplier string to enrich</span>
          </div>
          
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., HP CE285A Black Toner Cartridge Original LaserJet..."
              className="flex-1 h-11 bg-background"
            />
            <Button 
              type="submit" 
              disabled={!input.trim()}
              className="h-11 px-6 gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Job
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBulkUpload}
              className="h-11 px-4 gap-2"
            >
              <Upload className="w-4 h-4" />
              Bulk CSV
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
