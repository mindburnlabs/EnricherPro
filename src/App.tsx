import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { triggerResearch } from './lib/api.js';
import { ToastProvider } from './components/layout/ToastContext.js';

// Layouts & Views
import { AppLayout } from './components/layout/AppLayout.js';
import { D2Home } from './components/views/D2Home.js';
import { AuditTimeline } from './components/views/AuditTimeline.js';
import { ConfigView } from './components/views/ConfigView.js';
import { SettingsView } from './components/Settings/SettingsView.js';
import { DashboardView } from './components/views/DashboardView.js';

// Research Components
import { ChatLayout } from './components/Chat/ChatLayout.js';
import { ChatInterface } from './components/Chat/ChatInterface.js';
import { SplitLayout } from './components/layout/SplitLayout.js';
import { SKUCard } from './components/sku/SKUCard.js';
import { ItemDetail } from './components/Research/ItemDetail.js';

// Stores & Hooks
import { useSettingsStore } from './stores/settingsStore.js';
import { useResearchStream } from './hooks/useResearchStream.js';

type ViewState = 'home' | 'research' | 'dashboard' | 'audit' | 'config';

const App: React.FC = () => {
    const { t } = useTranslation('common');
    
    // View State
    const [currentView, setCurrentView] = useState<ViewState>('home');
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Theme Logic (Persistent)
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
             return 'dark'; // Force Dark Default for D2
        }
        return 'dark';
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // Consolidated Stream Hook
    const { status, progress, activeSku, logs, startStream, reset } = useResearchStream();

    // Handler: User submits search from Home
    // Auto-open settings if keys missing
    const { apiKeys, sources, budgets } = useSettingsStore();
    useEffect(() => {
        if (!apiKeys.firecrawl || !apiKeys.openRouter) {
             // Only auto-open if likely not configured
             // setIsSettingsOpen(true); 
        }
    }, []);

    // Handler: User submits search from Home
    const handleHomeSearch = async (query: string) => {
        try {
            // Trigger API to start job
            const res = await triggerResearch(query, 'balanced', {
                apiKeys,
                budgets,
                sourceConfig: sources
            });
            if (res.jobId) {
                setActiveJobId(res.jobId);
                startStream(res.jobId);
                setCurrentView('research'); // Switch view
            }
        } catch (e) {
            console.error("Failed to start research", e);
            // TODO: Show toast error
        }
    };

    // Handler: User submits chat from Research View
    const handleChatSearch = (jobId: string) => {
         setActiveJobId(jobId);
         startStream(jobId);
    };



    // Render View Content
    const renderContent = () => {
        switch (currentView) {
            case 'home':
                return <D2Home onSearch={handleHomeSearch} />;
            
            case 'research':
                return (
                    <SplitLayout
                        rightPanelOpen={!!activeSku || status === 'running'}
                        leftPanel={
                            <ChatLayout
                                onSettingsClick={() => setIsSettingsOpen(true)}
                                onThemeToggle={toggleTheme}
                                theme={theme}
                            >
                                <ChatInterface 
                                    onJobCreated={handleChatSearch}
                                    activeJobId={activeJobId || undefined}
                                    streamLogs={logs} // Pass logs to chat
                                    streamStatus={status}
                                />
                            </ChatLayout>
                        }
                        rightPanel={
                            <div className="h-full relative flex flex-col">
                                {/* Header / Close (Mobile mostly) */}
                                <div className="p-2 flex justify-end">
                                     {/* Could add a minimize button here */}
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 pt-0">
                                    {/* Progress Bar */}
                                    {status === 'running' && (
                                        <div className="mb-6 animate-in slide-in-from-top-2">
                                            <div className="h-1.5 w-full bg-surface border border-border-subtle rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary-accent shadow-[0_0_10px_rgba(var(--text-accent),0.5)] transition-all duration-500 ease-out" 
                                                    style={{ width: `${Math.max(5, progress)}%` }} 
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] uppercase tracking-wider text-primary-subtle mt-1 font-medium">
                                                <span>processing</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* SKU Card */}
                                    <SKUCard 
                                        data={activeSku} 
                                        isLoading={status === 'running' && !activeSku}
                                    />
                                </div>
                            </div>
                        }
                    />
                );

            case 'audit':
                return <AuditTimeline />;
            
            case 'config':
                return <ConfigView />;


            case 'dashboard':
                return <DashboardView />;
                
            default:
                return <D2Home onSearch={handleHomeSearch} />;
        }
    };

    // Item Management Handlers
    const [isItemDetailOpen, setIsItemDetailOpen] = useState(false);

    const handleApproveItem = async (id: string) => {
        try {
            await fetch(`/api/items/${id}/approve`, { method: 'POST' });
            // Ideally trigger refresh or update local state
            setIsItemDetailOpen(false);
        } catch (e) {
            console.error("Failed to approve item", e);
        }
    };

    const handleUpdateItem = async (id: string, field: string, value: any, source: string) => {
        try {
            await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, value, source })
            });
            // Update local state if needed (optimistic)
        } catch (e) {
            console.error("Failed to update item", e);
        }
    };

    return (
        <ToastProvider>
            <AppLayout currentView={currentView} onNavigate={(v) => {
                setCurrentView(v as ViewState);
            }}>
                {renderContent()}
            </AppLayout>

            <SettingsView
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onThemeChange={toggleTheme}
                currentTheme={theme}
            />

            <ItemDetail
                item={activeSku}
                open={isItemDetailOpen}
                onClose={() => setIsItemDetailOpen(false)}
                onApprove={handleApproveItem}
                onUpdate={handleUpdateItem}
            />
        </ToastProvider>
    );
};

export default App;
