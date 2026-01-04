import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Clock, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';
  return Math.floor(seconds) + ' seconds ago';
}

// ... existing interfaces ...

// Inside component:
// {timeAgo(new Date(job.startTime))}

interface Job {
  id: string;
  inputRaw: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  progress: number;
}

interface JobHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadJob: (jobId: string) => void;
}

export const JobHistory: React.FC<JobHistoryProps> = ({ isOpen, onClose, onLoadJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
    }
  }, [isOpen]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs?limit=50');
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (e) {
      console.error('Failed to load jobs', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200'>
      <div className='bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col h-[85vh]'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl'>
          <h2 className='text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
            <Clock className='w-5 h-5 text-emerald-600' />
            Research History
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500'
          >
            <ArrowRight className='w-5 h-5' />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-4'>
          {loading ? (
            <div className='flex justify-center items-center h-48'>
              <Loader2 className='w-8 h-8 animate-spin text-emerald-500' />
            </div>
          ) : (
            <table className='w-full text-left border-collapse'>
              <thead>
                <tr className='border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 font-medium'>
                  <th className='p-4'>Date</th>
                  <th className='p-4'>Input Query</th>
                  <th className='p-4'>Status</th>
                  <th className='p-4 text-right'>Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50 dark:divide-gray-800'>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className='group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
                  >
                    <td className='p-4 text-sm text-gray-500 whitespace-nowrap'>
                      {timeAgo(new Date(job.startTime))}
                    </td>
                    <td className='p-4'>
                      <div
                        className='text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 max-w-md'
                        title={job.inputRaw}
                      >
                        {job.inputRaw}
                      </div>
                    </td>
                    <td className='p-4'>
                      <StatusBadge status={job.status} />
                    </td>
                    <td className='p-4 text-right'>
                      <button
                        onClick={() => {
                          onLoadJob(job.id);
                          onClose();
                        }}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors'
                      >
                        <Play className='w-3 h-3' />
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'>
          <CheckCircle className='w-3 h-3' /> Completed
        </span>
      );
    case 'running':
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
          <Loader2 className='w-3 h-3 animate-spin' /> Running
        </span>
      );
    case 'failed':
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'>
          <XCircle className='w-3 h-3' /> Failed
        </span>
      );
    default:
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'>
          <Clock className='w-3 h-3' /> Pending
        </span>
      );
  }
};
