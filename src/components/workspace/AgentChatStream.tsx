import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  Search,
  Image,
  FileText,
  AlertTriangle
} from "lucide-react";
import type { AgentMessage } from "@/types/job";
import { cn } from "@/lib/utils";

interface AgentChatStreamProps {
  messages: AgentMessage[];
  onDecision?: (messageId: string, decision: string) => void;
  isProcessing?: boolean;
}

function getMessageIcon(type: AgentMessage['type']) {
  switch (type) {
    case 'plan':
      return <Sparkles className="w-4 h-4 text-primary" />;
    case 'activity':
      return <Search className="w-4 h-4 text-chart-2" />;
    case 'decision':
      return <AlertCircle className="w-4 h-4 text-status-conflict" />;
    case 'blocker':
      return <AlertTriangle className="w-4 h-4 text-status-failed" />;
    case 'result':
      return <CheckCircle2 className="w-4 h-4 text-status-verified" />;
    default:
      return <Bot className="w-4 h-4" />;
  }
}

function AgentMessageBubble({ 
  message, 
  onDecision 
}: { 
  message: AgentMessage; 
  onDecision?: (messageId: string, decision: string) => void;
}) {
  const isDecision = message.type === 'decision';
  const isBlocker = message.type === 'blocker';

  return (
    <div className={cn(
      "animate-slide-in-up p-4 rounded-lg border transition-all",
      isBlocker ? "bg-status-failed/5 border-status-failed/20" :
      isDecision ? "bg-status-conflict/5 border-status-conflict/20" :
      "bg-card border-border"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isBlocker ? "bg-status-failed/10" :
          isDecision ? "bg-status-conflict/10" :
          "bg-primary/10"
        )}>
          {getMessageIcon(message.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {message.agentName && (
              <span className="text-xs font-medium text-primary">
                {message.agentName}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <p className="text-sm text-foreground leading-relaxed">
            {message.content}
          </p>

          {isDecision && onDecision && (
            <div className="flex items-center gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={() => onDecision(message.id, 'accept')}
                className="h-8"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Accept Evidence
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onDecision(message.id, 'select')}
                className="h-8"
              >
                Select Model
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onDecision(message.id, 'skip')}
                className="h-8 text-muted-foreground"
              >
                Skip
              </Button>
            </div>
          )}

          {isBlocker && (
            <div className="flex items-center gap-2 mt-3">
              <Button 
                size="sm" 
                variant="destructive"
                className="h-8"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                View Error
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-8"
              >
                Retry Task
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentChatStream({ messages, onDecision, isProcessing }: AgentChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Agent Activity</CardTitle>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <CardContent className="p-4 space-y-3">
          {messages.map((message) => (
            <AgentMessageBubble 
              key={message.id} 
              message={message} 
              onDecision={onDecision}
            />
          ))}
          
          {messages.length === 0 && (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Waiting for job to start...</p>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50">
              <div className="flex space-x-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-typing" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-typing" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-typing" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-muted-foreground">Agent is thinking...</span>
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
