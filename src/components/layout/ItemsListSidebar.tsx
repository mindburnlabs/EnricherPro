import React, { useEffect, useState } from 'react';
import { Clock, Loader2, AlertCircle } from 'lucide-react';

interface SidebarItemProps {
  date: string;
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
      <div className='text-[10px] text-primary-subtle truncate flex items-center gap-1'>
        {new Date(date).toLocaleDateString()}
        {status === 'failed' && <AlertCircle size={8} className='text-red-500' />}
      </div>
    </div>
  </button>
);

export const ItemsListSidebar: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        // We use jobs endpoint for now to get the recent "searches"
        const res = await fetch('/api/jobs?limit=10');
        if (res.ok) {
          const data = await res.json();
          setItems(data.jobs || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  if (loading)
    return (
      <div className='px-3 py-2 text-xs text-primary-subtle flex gap-2'>
        <Loader2 size={12} className='animate-spin' /> Loading...
      </div>
    );

  return (
    <>
      {items.map((job) => (
        <SidebarItem
          key={job.id}
          label={job.inputRaw}
          date={job.startTime}
          status={job.status}
          onClick={() => {
            // In a real app, navigation logic here
            window.location.href = `/?jobId=${job.id}`;
          }}
        />
      ))}
    </>
  );
};
