import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    loadingText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className = '',
        variant = 'primary',
        size = 'md',
        isLoading = false,
        loadingText,
        leftIcon,
        rightIcon,
        children,
        disabled,
        ...props
    }, ref) => {

        const baseStyles = 'inline-flex items-center justify-center font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary-accent/50 disabled:opacity-50 disabled:pointer-events-none active:scale-95 duration-200';

        const variants = {
            primary: 'bg-primary-accent text-white shadow-lg shadow-primary-accent/30 hover:bg-primary-accent/90',
            secondary: 'bg-white dark:bg-slate-700 text-primary border border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-600',
            outline: 'bg-transparent border-2 border-primary-accent text-primary-accent hover:bg-primary-accent/5',
            ghost: 'bg-transparent text-primary-subtle hover:text-primary hover:bg-primary-subtle/10',
            danger: 'bg-white border-2 border-status-error text-status-error hover:bg-status-error hover:text-white',
            success: 'bg-status-success text-white hover:bg-status-success/90 shadow-lg shadow-status-success/30'
        };

        const sizes = {
            sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
            md: 'text-sm px-5 py-2.5 rounded-xl gap-2',
            lg: 'text-base px-6 py-3.5 rounded-2xl gap-2.5'
        };

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
                {!isLoading && leftIcon}
                {isLoading && loadingText ? loadingText : children}
                {!isLoading && rightIcon}
            </button>
        );
    }
);

Button.displayName = "Button";

export { Button };
