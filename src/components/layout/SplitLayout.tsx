import React, { ReactNode } from 'react';

interface SplitLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  rightPanelOpen?: boolean;
}

export function SplitLayout({ leftPanel, rightPanel, rightPanelOpen = true }: SplitLayoutProps) {
  return (
    <div className='flex h-screen w-full bg-gray-50 dark:bg-gray-900 overflow-hidden text-slate-900 dark:text-slate-100 font-sans'>
      {/* Left Panel (Main/Chat) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${rightPanelOpen ? 'w-1/2' : 'w-full'}`}
      >
        {leftPanel}
      </div>

      {/* Right Panel (SKU Context) */}
      {rightPanelOpen && (
        <div className='w-1/2 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col shadow-xl z-10 transition-all duration-300 ease-in-out'>
          {/* Header integration to be handled by content */}
          <div className='flex-1 overflow-y-auto p-0'>{rightPanel}</div>
        </div>
      )}
    </div>
  );
}
