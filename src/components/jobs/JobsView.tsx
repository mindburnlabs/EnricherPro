import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Upload,
  Search,
  Filter,
  Zap,
  CreditCard,
  Activity,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useJobs, useCreateJob, useRealData } from '@/hooks/useBackend';
import { Job } from '@/types/job';

/* Remove mockJobs */

const statusColors: Record<string, string> = {
  running: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  needs_review: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  blocked: 'bg-red-500/10 text-red-500 border-red-500/20',
  ready_to_publish: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

interface JobsViewProps {
  onSelectJob?: (jobId: string) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ onSelectJob }) => {
  const { t } = useTranslation(['jobs', 'common']);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  /* Use useRealData for unified data access including budgetData */
  const { jobs, budgetData, createJob } = useRealData();
  const [isLoading, setIsLoading] = useState(false); // Local loading state if needed, or derived

  const handleCreateJob = (input: string) => {
    if (input.trim()) {
      createJob(input);
      setSearch('');
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesFilter = filter === 'all' || job.status === filter;
    const matchesSearch = job.inputString.toLowerCase().includes(search.toLowerCase()) ||
                          job.mpn?.toLowerCase().includes(search.toLowerCase()) ||
                          job.brand?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getCount = (status: string) => {
    if (status === 'all') return jobs.length;
    return jobs.filter(j => j.status === status).length;
  };

  const stats = [
    { label: t('filters.all'), count: getCount('all'), id: 'all' },
    { label: t('filters.running'), count: getCount('running'), id: 'running' },
    { label: t('filters.completed'), count: getCount('completed'), id: 'completed' },
    { label: t('filters.failed'), count: getCount('failed'), id: 'failed' },
    { label: t('filters.needs_review'), count: getCount('needs_review'), id: 'needs_review' },
    { label: t('filters.blocked'), count: getCount('blocked'), id: 'blocked' },
    { label: t('filters.ready_to_publish'), count: getCount('ready_to_publish'), id: 'ready_to_publish' },
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-hidden max-w-[1600px] mx-auto w-full">
      
      {/* Header Area */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Hero Input Section from Screenshot */}
      <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
         <div className="flex items-center gap-2 text-orange-500 mb-4 text-sm font-medium">
            <Zap size={16} />
            {t('common:actions.enter_value', 'Enter a supplier string to enrich')}
         </div>
         <div className="flex gap-4">
           <Input 
             className="flex-1 bg-background/50 h-12 text-lg" 
             placeholder={t('search_placeholder', "Search by input string or filter...")}
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    handleCreateJob(search);
                }
             }}
           />
           <Button 
             size="lg" 
             className="h-12 bg-orange-600 hover:bg-orange-700 text-white gap-2"
             onClick={() => handleCreateJob(search)}
           >
             <Plus size={18} />
             {t('new_job')}
           </Button>
           <Button size="lg" variant="outline" className="h-12 gap-2">
             <Upload size={18} />
             {t('bulk_csv')}
           </Button>
         </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        
        {/* Main List Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Filter Bar */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {stats.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilter(s.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex items-center gap-2",
                  filter === s.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-surface border-border hover:border-gray-400 text-muted-foreground"
                )}
              >
                {s.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px]", 
                  filter === s.id ? "bg-primary-foreground/20" : "bg-gray-200 dark:bg-gray-800"
                )}>
                  {s.count}
                </span>
              </button>
            ))}
          </div>

          {/* Jobs Table */}
          <div className="border border-border/50 rounded-xl bg-card flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">{t('table.input')}</div>
              <div className="col-span-2">{t('table.mpn')}</div>
              <div className="col-span-2">{t('table.brand')}</div>
              <div className="col-span-2">{t('table.status')}</div>
              <div className="col-span-2 text-right">{t('table.time')}</div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
               {isLoading && (
                  <div className="p-8 text-center text-muted-foreground">{t('common:loading', 'Loading...')}</div>
               )}
               {filteredJobs.map(job => (
                 <div 
                    key={job.id} 
                    className="grid grid-cols-12 gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors items-center group cursor-pointer border border-transparent hover:border-border/50"
                    onClick={() => onSelectJob?.(job.id)}
                 >
                    <div className="col-span-4 font-medium truncate text-sm" title={job.inputString}>
                      {job.inputString}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground font-mono">
                      {job.mpn || '-'}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {job.brand || '-'}
                    </div>
                    <div className="col-span-2">
                       <Badge variant="outline" className={cn("text-xs font-normal", statusColors[job.status] || 'bg-gray-100 text-gray-500')}>
                          <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block", (statusColors[job.status] || 'bg-gray-500').replace('bg-', 'bg-current opacity-70'))}></span>
                          {t(`status.${job.status}`)}
                       </Badge>
                    </div>
                    <div className="col-span-2 text-right text-xs text-muted-foreground flex items-center justify-end gap-2">
                       {job.updatedAt ? formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true }) : '-'}
                       <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Budget & Stats */}
        <div className="w-80 flex-none flex flex-col gap-4">
           <Card className="bg-card border-border/50">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">{t('budget.title')}</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
                
                <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Zap size={14} className="text-blue-500" /> {t('budget.tokens')}
                       </span>
                       <span className="font-mono">{budgetData.tokenUsage.toLocaleString()} / {budgetData.tokenLimit.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500" style={{ width: `${Math.min((budgetData.tokenUsage / budgetData.tokenLimit) * 100, 100)}%` }} />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                       <span className="flex items-center gap-2 text-muted-foreground">
                         <CreditCard size={14} className="text-green-500" /> {t('budget.cost')}
                       </span>
                       <span className="font-mono">${budgetData.estimatedCost.toFixed(2)} / ${budgetData.costLimit.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                       <div className="h-full bg-green-500" style={{ width: `${Math.min((budgetData.estimatedCost / budgetData.costLimit) * 100, 100)}%` }} />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                       <span className="flex items-center gap-2 text-muted-foreground">
                         <Activity size={14} className="text-orange-500" /> {t('budget.api_calls')}
                       </span>
                       <span className="font-mono">{budgetData.apiCalls} / {budgetData.apiCallLimit}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                       <div className="h-full bg-orange-500" style={{ width: `${Math.min((budgetData.apiCalls / budgetData.apiCallLimit) * 100, 100)}%` }} />
                    </div>
                 </div>

             </CardContent>
           </Card>

           <div className="bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border border-indigo-500/10 rounded-xl p-6">
              <h3 className="font-semibold text-indigo-400 mb-2">Pro Tip</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your <strong>Firecrawl API</strong> key in settings to enable deep PDF parsing for spec extraction.
              </p>
              <Button variant="link" className="text-indigo-400 p-0 h-auto mt-2 text-xs">
                Configure Keys &rarr;
              </Button>
           </div>
        </div>

      </div>
    </div>
  );
};
