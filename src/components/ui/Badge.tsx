// ============================================================================
// components/ui/Badge.tsx — Status and label badges
// ============================================================================

import { classNames } from '@/utils/helpers'

export type BadgeVariant = 'default' | 'success' | 'pending' | 'failed' | 'info' | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-bg-hover text-text-secondary border-border',
  success: 'bg-status-success/10 text-status-success border-status-success/30',
  pending: 'bg-status-pending/10 text-status-pending border-status-pending/30',
  failed: 'bg-status-failed/10 text-status-failed border-status-failed/30',
  info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  outline: 'bg-transparent text-text-secondary border-border',
}

const SIZES = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
}

export function Badge({ className, variant = 'default', size = 'md', children, ...props }: BadgeProps) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-md border font-medium',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
