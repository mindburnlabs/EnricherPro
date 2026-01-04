import React from 'react';

export const ConfidenceRing = ({ score }: { score?: number }) => {
  if (score === undefined || score === null)
    return <div className='w-5 h-5 rounded-full border-2 border-gray-100 dark:border-gray-800' />;

  // Ensure score is 0-100
  const percentage = score > 1 ? score : score * 100;
  const color =
    percentage > 80 ? 'text-emerald-500' : percentage > 50 ? 'text-amber-500' : 'text-red-500';
  const trackColor = 'text-gray-200 dark:text-gray-700';

  // SVG circumference = 2 * pi * r
  // r=8, circ ~ 50.24
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className='relative w-5 h-5 flex items-center justify-center shrink-0'>
      <svg className='transform -rotate-90 w-full h-full'>
        <circle
          className={trackColor}
          strokeWidth='2.5'
          stroke='currentColor'
          fill='transparent'
          r={radius}
          cx='10'
          cy='10'
        />
        <circle
          className={`${color} transition-all duration-1000 ease-out`}
          strokeWidth='2.5'
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap='round'
          stroke='currentColor'
          fill='transparent'
          r={radius}
          cx='10'
          cy='10'
        />
      </svg>
    </div>
  );
};
