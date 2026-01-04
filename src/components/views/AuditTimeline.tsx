import React from 'react';
import { Check, Clock, ShieldAlert, User, Search, Database, ArrowRight } from 'lucide-react';

export const AuditTimeline: React.FC = () => {
    // Mock Data for MVP
    const events = [
        {
            id: 1,
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            type: 'synthesis',
            agent: 'Synthesis Agent',
            action: 'Merged Data',
            details: 'Combined official sources for Canon 057 yield.',
            status: 'success'
        },
        {
            id: 2,
            timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
            type: 'conflict',
            agent: 'Governance',
            action: 'Conflict Detected',
            details: 'Yield mismatch: 3100 (Official) vs 3000 (Retailer).',
            status: 'warning'
        },
        {
            id: 3,
            timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
            type: 'extraction',
            agent: 'Logistics Agent',
            action: 'Extracted Weight',
            details: 'Found 0.85kg on nix.ru.',
            status: 'success'
        },
        {
            id: 4,
            timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            type: 'start',
            agent: 'Orchestrator',
            action: 'Started Job',
            details: 'Job ID: job_123456789',
            status: 'info'
        }
    ];

    const getIcon = (type: string) => {
        switch (type) {
            case 'synthesis': return <Database className="w-4 h-4 text-purple-500" />;
            case 'conflict': return <ShieldAlert className="w-4 h-4 text-amber-500" />;
            case 'extraction': return <Search className="w-4 h-4 text-blue-500" />;
            case 'start': return <ArrowRight className="w-4 h-4 text-emerald-500" />;
            default: return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Audit Timeline</h1>
            <p className="text-gray-500 mb-8">Traceability log for agent actions and data decisions.</p>

            <div className="relative border-l-2 border-gray-200 dark:border-gray-800 ml-4 space-y-8">
                {events.map((event) => (
                    <div key={event.id} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-white dark:bg-black flex items-center justify-center`}>
                           <div className="bg-gray-200 dark:bg-gray-700 w-2 h-2 rounded-full"></div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        {getIcon(event.type)}
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white">{event.agent}</span>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{event.action}</span>
                                </div>
                                <span className="text-xs text-gray-400 font-mono">
                                    {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
                                {event.details}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
