import { useState, useCallback } from "react";
import { AppSidebar, ViewType } from "@/components/layout/AppSidebar";
import { HomeScreen } from "@/components/home/HomeScreen";
import { CreateJobForm } from "@/components/dashboard/CreateJobForm";
import { JobFilters } from "@/components/dashboard/JobFilters";
import { JobTable } from "@/components/dashboard/JobTable";
import { BudgetWidget } from "@/components/dashboard/BudgetWidget";
import { AgentChatStream } from "@/components/workspace/AgentChatStream";
import { SKUCard } from "@/components/workspace/SKUCard";
import { WorkspaceToolbar } from "@/components/workspace/WorkspaceToolbar";
import { EvidenceDrawer } from "@/components/workspace/EvidenceDrawer";
import { ConflictResolutionModal } from "@/components/workspace/ConflictResolutionModal";
import { ExportManager } from "@/components/export/ExportManager";
import { AuditLogView } from "@/components/audit/AuditLogView";
import { ConfigurationPanel } from "@/components/config/ConfigurationPanel";
import { useMockData } from "@/hooks/useMockData";
import { useTheme } from "@/hooks/useTheme";
import type { JobStatus } from "@/types/job";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Index() {
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [activeFilter, setActiveFilter] = useState<JobStatus | 'all'>('all');
  const [evidenceDrawer, setEvidenceDrawer] = useState<{ isOpen: boolean; fieldName: string }>({
    isOpen: false,
    fieldName: '',
  });
  const [isPaused, setIsPaused] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'enrichment' | 'export'>('enrichment');

  const { isDark, toggleTheme } = useTheme();

  const {
    jobs,
    selectedJob,
    agentMessages,
    skuData,
    budgetData,
    isProcessing,
    auditEntries,
    systemConfig,
    validationBlockers,
    activeConflict,
    selectJob,
    createJob,
    getEvidence,
    getFilterCounts,
    setSkuData,
    setSystemConfig,
    triggerConflict,
    resolveConflict,
    addAuditEntry,
    removeBlocker,
  } = useMockData();

  const filteredJobs = activeFilter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === activeFilter);

  const handleSelectJob = useCallback((job: typeof jobs[0]) => {
    selectJob(job);
    setActiveView('workspace');
  }, [selectJob]);

  const handleViewEvidence = useCallback((fieldName: string) => {
    setEvidenceDrawer({ isOpen: true, fieldName });
  }, []);

  const handleToggleLock = useCallback((fieldName: string) => {
    if (!skuData) return;
    
    const field = skuData[fieldName as keyof typeof skuData];
    const isCurrentlyLocked = typeof field === 'object' && field !== null && 'status' in field && field.status === 'locked';
    
    setSkuData(prev => {
      if (!prev) return prev;
      const f = prev[fieldName as keyof typeof prev];
      if (typeof f === 'object' && f !== null && 'status' in f) {
        return {
          ...prev,
          [fieldName]: {
            ...f,
            status: f.status === 'locked' ? 'verified' : 'locked',
          },
        };
      }
      return prev;
    });
    
    if (selectedJob) {
      addAuditEntry({
        action: 'field_lock',
        fieldName,
        beforeValue: String(typeof field === 'object' && 'value' in field ? field.value : ''),
        afterValue: String(typeof field === 'object' && 'value' in field ? field.value : ''),
        userId: 'current-user',
        jobId: selectedJob.id,
      });
    }
    
    toast.success(`Field ${fieldName} ${isCurrentlyLocked ? 'unlocked' : 'locked'}`);
  }, [skuData, setSkuData, selectedJob, addAuditEntry]);

  const handleDecision = useCallback((messageId: string, decision: string) => {
    if (decision === 'accept') {
      toast.success('Evidence accepted');
    } else if (decision === 'select') {
      triggerConflict('dimensions');
    } else {
      toast.info('Question skipped');
    }
  }, [triggerConflict]);

  const handleVerifyHash = useCallback((evidenceId: string) => {
    toast.info('Verifying hash against live source...');
    setTimeout(() => {
      toast.success('Hash verified - content unchanged');
    }, 1500);
  }, []);

  const handleBulkUpload = useCallback(() => {
    toast.info('CSV upload dialog would open here');
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(prev => !prev);
    toast.info(isPaused ? 'Job resumed' : 'Job paused');
  }, [isPaused]);

  const handleStop = useCallback(() => {
    toast.warning('Job stopped');
    setActiveView('jobs');
  }, []);

  const handleRequestFix = useCallback((blockerId: string) => {
    toast.info('Agent is searching for missing data...');
    setTimeout(() => {
      removeBlocker(blockerId);
      toast.success('Blocker resolved by agent');
    }, 2000);
  }, [removeBlocker]);

  const handleExport = useCallback((format: 'ozon_xml' | 'yandex_yml' | 'wildberries_csv') => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  }, []);

  const handlePublish = useCallback(() => {
    toast.success('Published to all channels successfully!');
  }, []);

  const handleStartEnrichment = useCallback((supplierString: string) => {
    createJob(supplierString);
    setActiveView('jobs');
    toast.success('Enrichment job started');
  }, [createJob]);

  const handleViewChange = useCallback((view: ViewType) => {
    if (view === 'workspace' && !selectedJob) {
      setActiveView('jobs');
    } else {
      setActiveView(view);
    }
  }, [selectedJob]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar 
        activeView={activeView} 
        onViewChange={handleViewChange}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      
      <main className="flex-1 min-h-screen overflow-hidden">
        {/* Home - Perplexity-style landing */}
        {activeView === 'home' && (
          <HomeScreen 
            onStartEnrichment={handleStartEnrichment}
            onBulkUpload={handleBulkUpload}
          />
        )}

        {/* Jobs - List of all enrichment jobs */}
        {activeView === 'jobs' && (
          <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">Enrichment Jobs</h1>
              <p className="text-muted-foreground">Create and manage your data enrichment tasks</p>
            </div>

            <CreateJobForm onCreateJob={createJob} onBulkUpload={handleBulkUpload} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-4">
                <JobFilters
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  counts={getFilterCounts()}
                />
                <JobTable
                  jobs={filteredJobs}
                  onSelectJob={handleSelectJob}
                  selectedJobId={selectedJob?.id}
                />
              </div>

              <div className="lg:col-span-1">
                <BudgetWidget data={budgetData} />
              </div>
            </div>
          </div>
        )}

        {/* Workspace - Active enrichment session */}
        {activeView === 'workspace' && selectedJob && skuData && (
          <div className="h-screen flex flex-col">
            {/* Workspace Header */}
            <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-4 max-w-7xl mx-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveView('jobs')}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Jobs
                </Button>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedJob.inputString}
                  </p>
                </div>

                <Tabs value={workspaceTab} onValueChange={(v) => setWorkspaceTab(v as 'enrichment' | 'export')}>
                  <TabsList>
                    <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
                    <TabsTrigger value="export" className="gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {workspaceTab === 'enrichment' && (
                  <WorkspaceToolbar
                    cost={selectedJob.cost}
                    costLimit={systemConfig.budgetCaps.maxSpendPerSKU}
                    duration={selectedJob.duration}
                    durationLimit={systemConfig.budgetCaps.maxExecutionTime}
                    onPause={handlePause}
                    onStop={handleStop}
                    isPaused={isPaused}
                  />
                )}
              </div>
            </div>

            {/* Workspace Content */}
            {workspaceTab === 'enrichment' ? (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Agent Chat (60%) */}
                <div className="w-[60%] border-r overflow-hidden">
                  <AgentChatStream
                    messages={agentMessages}
                    onDecision={handleDecision}
                    isProcessing={isProcessing && !isPaused}
                  />
                </div>

                {/* Right Panel - SKU Card (40%) */}
                <div className="w-[40%] overflow-auto p-4 bg-muted/20">
                  <SKUCard
                    data={skuData}
                    onViewEvidence={handleViewEvidence}
                    onToggleLock={handleToggleLock}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto">
                  <ExportManager
                    skuId={selectedJob.id}
                    blockers={validationBlockers}
                    onRequestFix={handleRequestFix}
                    onExport={handleExport}
                    onPublish={handlePublish}
                  />
                </div>
              </div>
            )}

            {/* Evidence Drawer */}
            <EvidenceDrawer
              isOpen={evidenceDrawer.isOpen}
              onClose={() => setEvidenceDrawer({ isOpen: false, fieldName: '' })}
              fieldName={evidenceDrawer.fieldName}
              evidence={getEvidence(evidenceDrawer.fieldName)}
              onVerifyHash={handleVerifyHash}
            />

            {/* Conflict Resolution Modal */}
            <ConflictResolutionModal
              isOpen={!!activeConflict}
              onClose={() => resolveConflict({ 
                fieldName: activeConflict?.fieldName || '', 
                selectedValue: activeConflict?.claims[0]?.value || '', 
                source: 'left' 
              })}
              conflict={activeConflict}
              onResolve={resolveConflict}
            />
          </div>
        )}

        {/* Audit Log - Data lineage and change history */}
        {activeView === 'audit' && (
          <div className="p-6 max-w-7xl mx-auto">
            <div className="space-y-1 mb-6">
              <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
              <p className="text-muted-foreground">Track all data changes and user actions for compliance</p>
            </div>
            <AuditLogView entries={auditEntries} />
          </div>
        )}

        {/* Config - System settings and agent policies */}
        {activeView === 'config' && (
          <div className="p-6 max-w-5xl mx-auto">
            <div className="space-y-1 mb-6">
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">Configure agent behavior, budget limits, and source priorities</p>
            </div>
            <ConfigurationPanel 
              config={systemConfig} 
              onSave={setSystemConfig} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
