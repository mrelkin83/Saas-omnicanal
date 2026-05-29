import { cn } from '@/lib/ui/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        {
          'bg-accent-primary text-white hover:bg-accent-primary-hover shadow-glow-primary hover:shadow-lg':
            variant === 'primary',
          'bg-bg-surface-2 text-text-primary border border-border-default hover:bg-bg-surface-3':
            variant === 'secondary',
          'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20':
            variant === 'danger',
          'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-surface-2':
            variant === 'ghost',
        },
        {
          'px-3 py-1.5 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-5 py-2.5 text-base': size === 'lg',
        },
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
