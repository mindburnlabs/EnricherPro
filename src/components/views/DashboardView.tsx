
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Zap, 
    DollarSign, 
    Activity, 
    CheckCircle, 
    XCircle, 
    Clock, 
    AlertTriangle,
    Loader2,
    Eye
} from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    subtext: string;
    icon: any;
    colorClass: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, icon: Icon, colorClass }) => (
    <div className="bg-surface border border-border-subtle p-5 rounded-xl shadow-sm hover:shadow-md transition-all group">
        <div className="flex justify-between items-start mb-2">
            <div>
                <p className="text-xs font-medium text-primary-subtle uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold mt-1 text-primary">{value}</h3>
            </div>
            <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 group-hover:scale-110 transition-transform`}>
                <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
            </div>
        </div>
        <div className="w-full bg-border-subtle h-1.5 rounded-full mt-2 overflow-hidden">
            <div className={`h-full ${colorClass.replace('text-', 'bg-').replace('bg-opacity-10', '')}`} style={{ width: '70%' }}></div>
        </div>
        <p className="text-xs text-primary-subtle mt-2">{subtext}</p>
    </div>
);

export const DashboardView: React.FC = () => {
    const [jobs, setJobs] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mocking the fetch call since we can't easily run the backend function in this preview environment
        // In production: fetch('/api/jobs').then(...)
        // For now, let's simulate the API response to demonstrate the UI
        
        const fetchJobs = async () => {
            try {
                // Try fetching real API first
                const res = await fetch('/api/jobs');
                if (res.ok) {
                    const data = await res.json();
                    setJobs(data.jobs);
                    setStats(data.stats);
                } else {
                    throw new Error("Failed to fetch");
                }
            } catch (e) {
                // Fallback to mock data if API is not running locally (likely)
                console.warn("Using mock dashboard data");
                setJobs([
                    { id: 'job-123', inputRaw: 'HP 85A Black Toner', mpn: 'CE285A', brand: 'HP', status: 'published', updatedAt: new Date().toISOString() },
                    { id: 'job-124', inputRaw: 'Brother TN-2420 High Yield', mpn: 'TN-2420', brand: 'Brother', status: 'processing', updatedAt: new Date(Date.now() - 3600000).toISOString() },
                    { id: 'job-125', inputRaw: 'Canon 057', mpn: '3009C002', brand: 'Canon', status: 'needs_review', updatedAt: new Date(Date.now() - 7200000).toISOString() },
                    { id: 'job-126', inputRaw: 'Kyocera TK-1150', mpn: '-', brand: 'Kyocera', status: 'failed', updatedAt: new Date(Date.now() - 86400000).toISOString() },
                ]);
                setStats({
                    tokens: 125000,
                    cost: 4.52,
                    apiCalls: 142
                });
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published':
            case 'completed':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle size={12} className="mr-1" /> Ready</span>;
            case 'processing':
            case 'running':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 size={12} className="mr-1 animate-spin" /> Running</span>;
            case 'needs_review':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle size={12} className="mr-1" /> Review</span>;
            case 'failed':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle size={12} className="mr-1" /> Failed</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">{status}</span>;
        }
    };

    if (loading) return <div className="h-full w-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="p-8 h-full overflow-y-auto space-y-8 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
                    <p className="text-primary-subtle">Real-time system overview</p>
                </div>
                <button className="px-4 py-2 bg-primary text-background rounded-lg hover:opacity-90 transition shadow-lg text-sm font-medium flex items-center gap-2">
                    <Activity size={16} />
                    System Status: Healthy
                </button>
            </div>

            {/* Budget Overview Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard 
                    title="Total Tokens" 
                    value={stats?.tokens.toLocaleString()} 
                    subtext="31% of daily quota"
                    icon={Zap}
                    colorClass="text-blue-500"
                />
                <MetricCard 
                    title="Estimated Cost" 
                    value={`$${stats?.cost.toFixed(2)}`} 
                    subtext="$10.00 daily limit"
                    icon={DollarSign}
                    colorClass="text-emerald-500"
                />
                <MetricCard 
                    title="API Calls" 
                    value={stats?.apiCalls.toLocaleString()} 
                    subtext="42 calls / hour avg"
                    icon={Activity}
                    colorClass="text-rose-500"
                />
            </div>

            {/* Job Table */}
            <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-surface/50">
                    <h3 className="font-semibold text-primary">Recent Jobs</h3>
                    <div className="flex gap-2 text-xs">
                         <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"/> Completed</span>
                         <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-500 mr-1"/> Processing</span>
                    </div>
                </div>
                
                <table className="w-full text-sm">
                    <thead className="bg-surface/50 text-left text-xs font-medium text-primary-subtle uppercase tracking-wider border-b border-border-subtle">
                        <tr>
                            <th className="px-6 py-3">Input String</th>
                            <th className="px-6 py-3">MPN</th>
                            <th className="px-6 py-3">Brand</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Time</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {jobs.map((job) => (
                            <tr key={job.id} className="hover:bg-primary-subtle/5 transition-colors group">
                                <td className="px-6 py-4 truncate max-w-[200px] font-medium text-primary">
                                    {job.inputRaw}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-primary-subtle">
                                    {job.mpn || "—"}
                                </td>
                                <td className="px-6 py-4 text-primary-subtle">
                                    {job.brand || "—"}
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(job.status)}
                                </td>
                                <td className="px-6 py-4 text-primary-subtle flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(job.updatedAt).toLocaleTimeString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-1 hover:bg-primary-subtle/10 rounded text-primary-subtle hover:text-primary transition">
                                        <Eye size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {jobs.length === 0 && (
                     <div className="p-8 text-center text-primary-subtle">No jobs found</div>
                )}
            </div>
        </div>
    );
};
