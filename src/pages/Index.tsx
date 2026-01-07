import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomeScreen } from "@/components/home/HomeScreen";
import { JobsView } from "@/components/jobs/JobsView";
import { AuditLogView } from "@/components/audit/AuditLogView";
import { SettingsView } from "@/components/Settings/SettingsView";
import { ChatInterface } from "@/components/Chat/ChatInterface";
import { useTheme } from "@/hooks/useTheme";
import { useRealData } from "@/hooks/useBackend";

export default function Index() {
  const [currentView, setCurrentView] = useState<'home' | 'jobs' | 'audit' | 'config' | 'research'>('home');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();
  
  // Fetch real data
  const { auditEntries } = useRealData();

  // Navigation handlers
  const handleNavigate = (view: 'home' | 'jobs' | 'audit' | 'config' | 'research') => {
    setCurrentView(view);
    if (view !== 'research') {
      setActiveJobId(null);
    }
  };

  const handleStartResearch = (query: string) => {
    // Determine if it's a new job or we just go to research view with query
    // For now, switch to research view which handles the search input
    setCurrentView('research');
  };

  const handleJobCreated = (jobId: string) => {
    setActiveJobId(jobId);
  };

  return (
    <AppLayout currentView={currentView} onNavigate={handleNavigate}>
      {currentView === 'home' && (
        <HomeScreen 
          onStartEnrichment={handleStartResearch} 
          onBulkUpload={() => handleNavigate('jobs')} 
        />
      )}
      
      {currentView === 'jobs' && (
        <JobsView onSelectJob={(jobId) => {
            setActiveJobId(jobId);
            setCurrentView('research');
        }} />
      )}

      {currentView === 'audit' && (
        <AuditLogView entries={auditEntries} />
      )}

      {currentView === 'config' && (
        <SettingsView 
          isOpen={true} 
          onClose={() => handleNavigate('home')} 
          onThemeChange={toggleTheme}
          currentTheme={isDark ? 'dark' : 'light'}
        />
      )}

      {currentView === 'research' && (
        <ChatInterface 
          initialJobId={activeJobId} 
          onJobCreated={handleJobCreated} 
        />
      )}
    </AppLayout>
  );
}
