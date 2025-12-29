import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'plain';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({
        className = '',
        variant = 'default',
        padding = 'lg',
        children,
        ...props
    }, ref) => {

        const variants = {
            default: 'bg-card border border-border-subtle shadow-xl shadow-shadow-color/5',
            glass: 'glass-card',
            plain: 'bg-surface border border-border-subtle'
        };

        const paddings = {
            none: '',
            sm: 'p-4',
            md: 'p-6',
            lg: 'p-8'
        };

        return (
            <div
                ref={ref}
                className={`rounded-[24px] ${variants[variant]} ${paddings[padding]} ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";

export { Card };
