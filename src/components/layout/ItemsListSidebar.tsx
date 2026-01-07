import React from 'react';
import { Clock, Loader2, AlertCircle } from 'lucide-react';
import { useJobs } from '@/hooks/useBackend';

interface SidebarItemProps {
  date: Date;
  label: string;
  status: string;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ label, date, status, onClick }) => (
  <button
    onClick={onClick}
    className='w-full text-left px-3 py-2 rounded-md hover:bg-surface-highlight flex items-center gap-3 group transition-colors'
  >
    <Clock
      size={14}
      className='text-primary-subtle group-hover:text-primary transition-colors shrink-0'
    />
    <div className='min-w-0 flex-1'>
      <div className='text-sm text-primary truncate'>{label}</div>
      <div className='text-left text-[10px] text-primary-subtle truncate flex items-center gap-1'>
        {date.toLocaleDateString()}
        {status === 'failed' && <AlertCircle size={8} className='text-red-500' />}
      </div>
    </div>
  </button>
);

export const ItemsListSidebar: React.FC = () => {
  const { data: jobs, isLoading } = useJobs();

  if (isLoading)
    return (
      <div className='px-3 py-2 text-xs text-primary-subtle flex gap-2'>
        <Loader2 size={12} className='animate-spin' /> Loading...
      </div>
    );
  
  // Show last 5
  const recentJobs = (jobs || []).slice(0, 5);

  return (
    <>
      {recentJobs.map((job) => (
        <SidebarItem
          key={job.id}
          label={job.inputString}
          date={job.createdAt}
          status={job.status}
          onClick={() => {
            // In a real app, navigation logic here
            // window.location.href = `/?jobId=${job.id}`;
          }}
        />
      ))}
    </>
  );
};
