// ============================================================================
// components/ui/Card.tsx — Card container
// ============================================================================

import { classNames } from '@/utils/helpers'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  noPadding?: boolean
}

export function Card({ className, hover, noPadding, children, ...props }: CardProps) {
  return (
    <div
      className={classNames(
        'bg-bg-card border border-border rounded-xl',
        hover && 'hover:border-border-hover hover:bg-bg-hover/50 transition-all duration-200 cursor-pointer',
        !noPadding && 'p-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames('flex items-center justify-between mb-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={classNames('text-sm font-semibold text-text-primary', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={classNames('text-xs text-text-secondary', className)} {...props}>
      {children}
    </p>
  )
}
