import React from 'react';
import { Check, Clock, ShieldAlert, User, Search, Database, ArrowRight } from 'lucide-react';

export const AuditTimeline: React.FC = () => {
  // Mock Data for MVP - Enhanced with Diff Data
  const [events, setEvents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/audit?limit=20');
        if (res.ok) {
          const data = await res.json();

          // Map DB events to UI format
          const mapped = (data.events || []).map((e: any) => ({
            id: e.id,
            timestamp: e.timestamp,
            type: mapActionToType(e.action),
            agent: e.userId || 'System', // userId is used for agent name in backend for now
            action: e.action,
            details: e.reason || (e.entityType ? `Affected ${e.entityType}` : 'No details'),
            status: e.action.includes('fail')
              ? 'error'
              : e.action.includes('warn')
                ? 'warning'
                : 'success',
            diff:
              e.before && e.after
                ? {
                    field: e.entityType, // roughly
                    before: JSON.stringify(e.before),
                    after: JSON.stringify(e.after),
                  }
                : undefined,
          }));

          setEvents(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch audit log', err);
      }
    };
    fetchEvents();
  }, []);

  const mapActionToType = (action: string) => {
    if (action.includes('synthes')) return 'synthesis';
    if (action.includes('conflict')) return 'conflict';
    if (action.includes('extract')) return 'extraction';
    if (action.includes('start')) return 'start';
    return 'info';
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'synthesis':
        return <Database className='w-4 h-4 text-purple-500' />;
      case 'conflict':
        return <ShieldAlert className='w-4 h-4 text-amber-500' />;
      case 'extraction':
        return <Search className='w-4 h-4 text-blue-500' />;
      case 'start':
        return <ArrowRight className='w-4 h-4 text-emerald-500' />;
      default:
        return <Clock className='w-4 h-4 text-gray-500' />;
    }
  };

  return (
    <div className='p-8 max-w-4xl mx-auto h-full overflow-y-auto'>
      <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>Audit Timeline</h1>
      <p className='text-gray-500 mb-8'>Traceability log for agent actions and data decisions.</p>

      <div className='relative border-l-2 border-gray-200 dark:border-gray-800 ml-4 space-y-8'>
        {events.map((event) => (
          <div key={event.id} className='relative pl-8'>
            {/* Timeline Dot */}
            <div
              className={`absolute -left-[9px] top-6 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-white dark:bg-black flex items-center justify-center`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  event.status === 'warning'
                    ? 'bg-amber-500'
                    : event.status === 'success'
                      ? 'bg-emerald-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                }`}
              ></div>
            </div>

            <div className='bg-white dark:bg-[#0f1115] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200'>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800'>
                    {getIcon(event.type)}
                  </div>
                  <div>
                    <div className='flex items-center gap-2'>
                      <span className='font-bold text-gray-900 dark:text-white text-sm'>
                        {event.agent}
                      </span>
                      <span className='text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono'>
                        {event.action}
                      </span>
                    </div>
                    <div className='text-xs text-gray-400 mt-0.5'>{event.details}</div>
                  </div>
                </div>
                <span className='text-xs text-gray-400 font-mono'>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Diff View */}
              {event.diff && (
                <div className='mt-4 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs font-mono'>
                  <div className='flex items-center justify-between text-gray-500 mb-2 uppercase tracking-wider text-[10px] font-bold'>
                    <span>{event.diff.field}</span>
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='flex-1 p-2 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 rounded border border-red-100 dark:border-red-900/20 line-through opacity-75'>
                      {event.diff.before || 'null'}
                    </div>
                    <ArrowRight className='w-3 h-3 text-gray-400 flex-shrink-0' />
                    <div className='flex-1 p-2 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 rounded border border-emerald-100 dark:border-emerald-900/20 font-bold'>
                      {event.diff.after}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
