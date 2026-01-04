
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ResearchComposer } from '../Research/ResearchComposer.js';
import { useResearchStream } from '../../hooks/useResearchStream.js';
import { ChatMessage } from './types.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ChatResultBlock } from './ChatResultBlock.js';
import { triggerResearch, approveItem } from '../../lib/api.js';
import { EnrichedItem } from '../../types/domain.js';
import { User } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { ConflictResolverModal } from '../Research/ConflictResolverModal.js';


interface ChatInterfaceProps {
    onJobCreated?: (jobId: string) => void;
}

import { ItemDetail } from '../Research/ItemDetail.js';

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onJobCreated }) => {
    const { t } = useTranslation('common');
    const config = useSettingsStore();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // ... (State declarations same as before) ...
    const [conflictState, setConflictState] = useState<{ current: EnrichedItem, candidate: EnrichedItem } | null>(null);
    const [selectedResearchItem, setSelectedResearchItem] = useState<EnrichedItem | null>(null);
    const { steps, items, logs, status, error, startStream, reset } = useResearchStream();

    // ... (Effects same as before) ...

    const handleSearch = async (input: string | string[], mode: 'fast' | 'balanced' | 'deep', isRefinement?: boolean, forceRefresh: boolean = false) => {
        // ... (API Key check and Message Setup same as before) ...

        // SAFETY: Block if keys are missing
        if (!config.apiKeys.firecrawl || !config.apiKeys.openRouter) {
            alert(t('errors.missing_keys', "Please configure Firecrawl and OpenRouter API keys in Settings to proceed."));
            return;
        }

        const inputs = Array.isArray(input) ? input : [input];
        const queryText = inputs.join('\n');

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: queryText,
            timestamp: Date.now()
        };

        const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.jobId);
        const previousJobId = isRefinement ? lastAssistantMsg?.jobId : undefined;

        setMessages(prev => [...prev, userMsg]);
        setSelectedResearchItem(null); 

        try {
            const placeholderId = `pending-${Date.now()}`;
            setMessages(prev => [...prev, {
                id: placeholderId,
                role: 'assistant',
                content: '',
                status: 'running',
                steps: [{ id: 'init', label: 'initializing...', status: 'running' }],
                timestamp: Date.now()
            }]);

            const res = await triggerResearch(queryText, mode, {
                forceRefresh, 
                apiKeys: {
                    firecrawl: config.apiKeys.firecrawl,
                    openrouter: config.apiKeys.openRouter
                },
                agentConfig: {
                    prompts: config.prompts
                },
                sourceConfig: {
                    allowedTypes: {
                        official: config.sources.official,
                        marketplaces: config.sources.marketplace,
                        community: config.sources.community,
                        search: true
                    },
                    blockedDomains: config.sources.blockedDomains,
                    specificOfficial: config.sources.specificOfficial,
                    specificMarketplace: config.sources.specificMarketplace,
                    specificCommunity: config.sources.specificCommunity
                },
                budgets: config.budgets,
                previousJobId,
                model: config.model.id,
                useFlashPlanner: config.useFlashPlanner
            });

            if (res.success && res.jobId) {
                setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, id: res.jobId, jobId: res.jobId } : m));
                setActiveJobId(res.jobId);
                startStream(res.jobId);
                
                // Notify Parent
                if (onJobCreated) {
                    onJobCreated(res.jobId);
                }
            } else {
                setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, status: 'failed', error: 'Failed to start job' } : m));
            }


        } catch (e) {
            console.error(e);
            // Update error state
        }
    };

    const handleApprove = async (itemId: string) => {
        try {
            await approveItem(itemId);
            // Ideally update local state too to remove "Needs Review" badge
            setMessages(prev => prev.map(msg => {
                if (!msg.items) return msg;
                return {
                    ...msg,
                    items: msg.items.map(item => item.id === itemId ? { ...item, status: 'ok' } : item)
                };
            }));

            // Also update selected item if it's the one being approved
            if (selectedResearchItem && selectedResearchItem.id === itemId) {
                setSelectedResearchItem(prev => prev ? { ...prev, status: 'ok' } : null);
            }

        } catch (e) {
            console.error("Failed to approve item", e);
            alert("Failed to approve item. Please try again.");
        }
    };

    const handleMerge = (item: EnrichedItem) => {
        // In a real scenario, we would fetch the conflicting item from DB
        // For now, we simulate conflict by cloning the current item as 'current'
        // and using the passed item as 'candidate'
        const mockCurrent = { ...item, id: 'existing-db-item', data: { ...item.data, mpn_identity: { ...item.data.mpn_identity, mpn: "OLD-MPN" } } };
        setConflictState({ current: mockCurrent, candidate: item });
    };

    const handleResolveConflict = async (action: 'keep_current' | 'replace' | 'merge') => {
        if (!conflictState) return;

        try {
            const { resolveConflict } = await import('../../lib/api.js');
            await resolveConflict(conflictState.candidate.id, action, conflictState.current.id);

            // Optimistic update
            if (action === 'replace') {
                setMessages(prev => prev.map(msg => {
                    if (!msg.items) return msg;
                    return {
                        ...msg,
                        items: msg.items.map(item => item.id === conflictState.candidate.id ? { ...item, status: 'ok' } : item)
                    };
                }));
            }
        } catch (e) {
            console.error("Conflict resolution failed", e);
            alert(t('errors.resolution_failed', "Failed to resolve conflict."));
        } finally {
            setConflictState(null);
        }
    };

    const handleUpdateItem = async (id: string, field: string, value: any, source: string) => {
        console.log(`Manual Override: ${id} [${field}] = ${value} (via ${source})`);

        // Optimistic Update in UI
        if (selectedResearchItem && selectedResearchItem.id === id) {
            const newData = { ...selectedResearchItem.data };
            // Handle nested fields
            const parts = field.split('.');
            let current = newData as any;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {};
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;

            // Add Evidence Stub
            if (!newData._evidence) newData._evidence = {};
            newData._evidence[field] = {
                value: value,
                source_url: `manual:${source}`,
                confidence: 1.0,
                last_checked: new Date().toISOString(),
                method: 'manual',
                is_conflict: false
            };

            setSelectedResearchItem({ ...selectedResearchItem, data: newData });
        }

        // TODO: Call API to persist override
        // await api.updateItem(id, { [field]: value, _evidence: ... });
    };

    const handleRefresh = async (originalQuery: string, mode: 'fast' | 'balanced' | 'deep') => {
        // Trigger research with FORCE REFRESH
        await handleSearch(originalQuery, mode, false, true);
    };

    const isEmpty = messages.length === 0;

    return (
        <div className="flex h-full w-full relative overflow-hidden">

            {/* Main Chat Area - Shrinks when panel is open */}
            <div className={`flex flex-col h-full transition-all duration-300 ease-in-out ${selectedResearchItem ? 'w-1/2 min-w-[500px]' : 'w-full max-w-4xl mx-auto px-4'}`}>

                {/* Messages Area */}
                <div className={`flex-1 overflow-y-auto w-full pb-32 ${isEmpty ? 'hidden' : 'block'}`}>
                    <div className="pt-8 space-y-8 px-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                                {/* Avatar */}
                                {msg.role === 'assistant' && (
                                    <div className="flex-none w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-emerald-500/20 mt-1">
                                        AI
                                    </div>
                                )}

                                <div className={`flex-1 max-w-3xl space-y-3 ${msg.role === 'user' ? 'text-right' : ''}`}>

                                    {/* User Message Wrapper */}
                                    {msg.role === 'user' && (
                                        <div className="inline-block px-6 py-3.5 rounded-[24px] rounded-br-none bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-medium text-lg leading-relaxed shadow-sm">
                                            {msg.content}
                                        </div>
                                    )}

                                    {/* Assistant Content */}
                                    {msg.role === 'assistant' && (
                                        <div className="w-full">

                                            {/* Thinking Process */}
                                            {(msg.steps && msg.steps.length > 0) && (
                                                <ThinkingBlock
                                                    steps={msg.steps}
                                                    logs={msg.logs || []}
                                                    status={msg.status as any}
                                                />
                                            )}

                                            {/* Synthesis Preview - Replaced by Side Panel Live View */}

                                            {/* Error State */}
                                            {msg.error && (
                                                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900">
                                                    Error: {msg.error}
                                                </div>
                                            )}

                                            {/* Results */}
                                            {msg.items && msg.items.length > 0 && (
                                                <ChatResultBlock
                                                    items={msg.items}
                                                    onApprove={handleApprove}
                                                    onMerge={handleMerge}
                                                    onRefresh={() => handleSearch(msg.content, 'balanced', false, true)}
                                                    onSelectItem={setSelectedResearchItem} // Control selection
                                                    status={msg.status as any}
                                                />
                                            )}

                                            {/* Empty Result fallback */}
                                            {msg.status === 'completed' && (!msg.items || msg.items.length === 0) && !msg.error && (
                                                <p className="text-gray-500 italic">No items found matching the criteria.</p>
                                            )}

                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} className="h-4" />
                    </div>
                </div>

                {/* Input Area */}
                <div className={`transition-all duration-500 ease-in-out z-40 ${isEmpty ? 'flex-1 flex flex-col justify-center mb-[20vh]' : 'sticky bottom-0 pb-6 pt-4 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900'}`}>

                    {isEmpty && (
                        <div className="text-center mb-8 animate-in fade-in zoom-in duration-700">
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 mb-2">
                                {t('app.hero_title')}
                            </h1>
                            <p className="text-gray-500">{t('app.hero_subtitle')}</p>
                        </div>
                    )}

                    <div className="w-full px-4">
                        <ResearchComposer
                            onSubmit={handleSearch}
                            isProcessing={status === 'running'}
                            canRefine={!isEmpty && !activeJobId}
                            apiKeys={{
                                firecrawl: config.apiKeys.firecrawl,
                                openrouter: config.apiKeys.openRouter
                            }}
                        />
                    </div>
                </div>

            </div>

            {/* Right Detail Panel - Slide In */}
            <div className={`fixed top-0 right-0 h-full bg-white dark:bg-gray-900 shadow-2xl transition-all duration-300 ease-in-out transform border-l border-gray-200 dark:border-gray-800 z-50 ${selectedResearchItem ? 'translate-x-0 w-1/2 min-w-[600px]' : 'translate-x-full w-0 opacity-0'}`}>
                {selectedResearchItem && (
                    <ItemDetail
                        item={selectedResearchItem}
                        open={true}
                        onClose={() => setSelectedResearchItem(null)}
                        onApprove={handleApprove}
                        onUpdate={handleUpdateItem}
                    />
                )}
            </div>

            {/* Conflict Modal */}
            {conflictState && (
                <ConflictResolverModal
                    current={conflictState.current}
                    candidate={conflictState.candidate}
                    onResolve={handleResolveConflict}
                    onCancel={() => setConflictState(null)}
                />
            )}
        </div>
    );
};
