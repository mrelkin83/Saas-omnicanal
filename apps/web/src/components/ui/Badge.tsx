import { cn } from '@/lib/ui/cn';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        {
          'bg-bg-surface-2 text-text-secondary border-border-default': variant === 'default',
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': variant === 'success',
          'bg-amber-500/10 text-amber-400 border-amber-500/20': variant === 'warning',
          'bg-red-500/10 text-red-400 border-red-500/20': variant === 'danger',
          'bg-blue-500/10 text-blue-400 border-blue-500/20': variant === 'info',
        },
        {
          'px-2 py-0.5 text-[10px]': size === 'sm',
          'px-2.5 py-1 text-xs': size === 'md',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
