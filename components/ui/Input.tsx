import React from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({
        className = '',
        label,
        error,
        leftIcon,
        rightIcon,
        containerClassName = '',
        placeholder,
        ...props
    }, ref) => {

        return (
            <div className={`w-full ${containerClassName}`}>
                {label && (
                    <label className="block text-xs font-bold text-primary-subtle mb-1.5 ml-1 uppercase tracking-wide">
                        {label}
                    </label>
                )}

                <div className="relative group">
                    {leftIcon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-subtle group-focus-within:text-primary-accent transition-colors pointer-events-none">
                            {leftIcon}
                        </div>
                    )}

                    <input
                        ref={ref}
                        className={`
              w-full bg-surface border-2 border-border-subtle rounded-xl 
              text-primary placeholder:text-primary-subtle/50 font-medium
              transition-all duration-200 outline-none
              focus:bg-card focus:border-primary-accent focus:ring-4 focus:ring-primary-accent/10
              disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800
              ${leftIcon ? 'pl-11' : 'pl-4'}
              ${rightIcon ? 'pr-11' : 'pr-4'}
              ${error ? 'border-status-error focus:border-status-error focus:ring-status-error/10' : ''}
              ${className} // allow overriding specific classes like py-4 vs py-2
            `}
                        // Defaults for UX
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={placeholder}
                        {...props}
                    />

                    {rightIcon && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-subtle pointer-events-none">
                            {rightIcon}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-1.5 ml-1 flex items-center gap-1.5 text-xs font-bold text-status-error animate-in slide-in-from-top-1 fade-in">
                        <AlertCircle size={12} />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

export { Input };
