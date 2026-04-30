import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'compact';
  className?: string;
}

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const compact = variant === 'compact';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border surface-card text-center shadow-sm',
        compact ? 'px-5 py-10' : 'px-6 py-14',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative mx-auto flex max-w-sm flex-col items-center">
        <div
          className={cn(
            'mb-4 grid place-items-center rounded-full border border-primary/15 bg-primary/10 text-primary shadow-sm',
            compact ? 'h-10 w-10' : 'h-12 w-12',
          )}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>
          {title}
        </p>
        {description && (
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
