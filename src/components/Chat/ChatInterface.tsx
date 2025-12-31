
import React, { useState, useEffect, useRef } from 'react';
import { ResearchComposer } from '../Research/ResearchComposer.js';
import { useResearchStream } from '../../hooks/useResearchStream.js';
import { ChatMessage } from './types.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ChatResultBlock } from './ChatResultBlock.js';
import { triggerResearch, approveItem } from '../../lib/api.js';
import { EnrichedItem } from '../../types/domain.js';
import { User } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';

interface ChatInterfaceProps { }

export const ChatInterface: React.FC<ChatInterfaceProps> = () => {
    const config = useSettingsStore();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Stream Hook
    const { steps, items, logs, status, error, startStream, reset } = useResearchStream();

    // Auto-scroll to bottom on new messages or stream updates
    useEffect(() => {
        // Only scroll if near bottom or new message? 
        // For now, gentle scroll
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, steps.length, items.length]);

    // Sync Stream Data to Active Message
    useEffect(() => {
        if (!activeJobId) return;

        setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];

            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === activeJobId) {
                // Update live
                lastMsg.steps = steps;
                lastMsg.logs = logs;
                lastMsg.items = items;
                lastMsg.status = status as any;
                lastMsg.error = error;

                // If stream finished, finalize
                if (status === 'completed' || status === 'failed') {
                    // We can clear activeJobId in a separate effect or here?
                    // Doing it here might cause flickers if next update comes.
                    // But status is 'completed' so stream is dead.
                }
            }
            return newMsgs;
        });

    }, [steps, items, logs, status, error, activeJobId]);

    // Cleanup active job when complete
    useEffect(() => {
        if (status === 'completed' || status === 'failed') {
            // Delay slightly or just clear
            setActiveJobId(null);
        }
    }, [status]);


    const handleSearch = async (input: string | string[], mode: 'fast' | 'balanced' | 'deep', isRefinement?: boolean) => {
        const inputs = Array.isArray(input) ? input : [input];
        const queryText = inputs.join('\n'); // Treat multiple lines as one complex query or handle multiple?

        // 1. Add User Message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: queryText,
            timestamp: Date.now()
        };

        // 2. Prepare Assistant Message Stub
        // For refinement, we might need previous jobId.
        // Get the LAST assistant message's job ID
        const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.jobId);
        const previousJobId = isRefinement ? lastAssistantMsg?.jobId : undefined;

        setMessages(prev => [...prev, userMsg]);

        try {
            // Optimistic Assistant Msg
            const placeholderId = `pending-${Date.now()}`;
            setMessages(prev => [...prev, {
                id: placeholderId,
                role: 'assistant',
                content: '',
                status: 'running',
                steps: [{ id: 'init', label: 'initializing...', status: 'running' }],
                timestamp: Date.now()
            }]);

            // For now specific to single input support in UI flow, loop if needed
            const res = await triggerResearch(queryText, mode, {
                apiKeys: {
                    firecrawl: config.apiKeys.firecrawl,
                    openrouter: config.apiKeys.openRouter,
                    perplexity: config.apiKeys.perplexity
                },
                sourceConfig: {
                    allowedTypes: {
                        official: config.sources.official,
                        marketplaces: config.sources.marketplace,
                        community: config.sources.community,
                        search: true
                    },
                    blockedDomains: config.sources.blockedDomains
                },
                budgets: config.budgets,
                previousJobId,
                model: config.model.id
            });

            if (res.success && res.jobId) {
                // Replace placeholder with real job
                setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, id: res.jobId, jobId: res.jobId } : m));
                setActiveJobId(res.jobId);
                startStream(res.jobId);
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
        } catch (e) {
            alert("Failed to approve");
        }
    };


    const isEmpty = messages.length === 0;

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto px-4 relative">

            {/* Messages Area */}
            <div className={`flex-1 overflow-y-auto w-full pb-32 ${isEmpty ? 'hidden' : 'block'}`}>
                <div className="pt-8 space-y-8">
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
            <div className={`transition-all duration-500 ease-in-out z-20 ${isEmpty ? 'flex-1 flex flex-col justify-center mb-[20vh]' : 'sticky bottom-0 pb-6 pt-4 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900'}`}>

                {isEmpty && (
                    <div className="text-center mb-8 animate-in fade-in zoom-in duration-700">
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 mb-2">
                            What do you want to verify?
                        </h1>
                        <p className="text-gray-500">Ask anything about specs, availability, or compatibility.</p>
                    </div>
                )}

                <div className="w-full">
                    <ResearchComposer
                        onSubmit={handleSearch}
                        isProcessing={status === 'running'}
                        canRefine={!isEmpty && !activeJobId} // Only allow refine if idle and has history
                    />
                </div>
            </div>
        </div>
    );
};
