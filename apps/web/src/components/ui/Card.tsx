import { cn } from '@/lib/ui/cn';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-bg-surface-1 transition-all',
        {
          'p-0': padding === 'none',
          'p-4': padding === 'sm',
          'p-5': padding === 'md',
          'p-6': padding === 'lg',
        },
        className,
      )}
    >
      {children}
    </div>
  );
}

Card.Header = function CardHeader({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex-1">{children}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

Card.Title = function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-semibold text-text-primary', className)}>
      {children}
    </h3>
  );
};

Card.Description = function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs text-text-tertiary mt-0.5', className)}>
      {children}
    </p>
  );
};

Card.Content = function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('', className)}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-border-subtle flex items-center gap-3', className)}>
      {children}
    </div>
  );
};
