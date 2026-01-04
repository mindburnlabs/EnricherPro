import React, { createContext, useContext, useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className='fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none'>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 w-80 p-4 rounded-xl shadow-lg border animate-in slide-in-from-right fade-in duration-300
                            ${toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800' : ''}
                            ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-800' : ''}
                            ${toast.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800' : ''}
                            ${toast.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800' : ''}
                        `}
          >
            {toast.type === 'success' && (
              <CheckCircle className='w-5 h-5 text-emerald-500 shrink-0' />
            )}
            {toast.type === 'error' && <AlertCircle className='w-5 h-5 text-red-500 shrink-0' />}
            {toast.type === 'warning' && (
              <AlertCircle className='w-5 h-5 text-amber-500 shrink-0' />
            )}
            {toast.type === 'info' && <Info className='w-5 h-5 text-blue-500 shrink-0' />}

            <div className='flex-1 text-sm text-gray-800 dark:text-gray-100 leading-tight pt-0.5'>
              {toast.message}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
