import { cn } from '@/lib/ui/cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-4',
        className,
      )}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-bg-surface-2 border border-border-subtle flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-text-tertiary" />
        </div>
      )}
      <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
      {description && (
        <p className="text-xs text-text-tertiary mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
