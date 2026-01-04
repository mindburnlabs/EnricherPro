import { useState } from "react";
import { 
  Briefcase, 
  Settings, 
  FileText, 
  Home,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export type ViewType = 'home' | 'jobs' | 'workspace' | 'audit' | 'config';

interface AppSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const navItems = [
  { id: 'home' as ViewType, label: 'Home', icon: Home },
  { id: 'jobs' as ViewType, label: 'Jobs', icon: Briefcase },
  { id: 'audit' as ViewType, label: 'Audit Log', icon: FileText },
  { id: 'config' as ViewType, label: 'Settings', icon: Settings },
];

export function AppSidebar({ activeView, onViewChange, isDark, onToggleTheme }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "h-screen flex flex-col border-r bg-sidebar transition-all duration-300 sticky top-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
            <Box className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-sidebar-foreground whitespace-nowrap">
                D²
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                beta
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id || 
            (item.id === 'jobs' && activeView === 'workspace');
          
          const button = (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full justify-start gap-3 h-10 transition-all",
                collapsed && "justify-center px-2",
                isActive 
                  ? "bg-primary/10 text-primary hover:bg-primary/15" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  {button}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {/* Theme Toggle */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleTheme}
                className="w-full justify-center h-10 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isDark ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            className="w-full justify-start gap-3 h-10 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
          </Button>
        )}

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full h-10 text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed ? "justify-center" : "justify-start gap-3"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
