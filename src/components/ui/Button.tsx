// ============================================================================
// components/ui/Button.tsx — Reusable button with variants
// ============================================================================

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { classNames } from '@/utils/helpers'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm shadow-accent-blue/30',
  secondary: 'bg-bg-hover hover:bg-border text-text-primary border border-border',
  ghost: 'bg-transparent hover:bg-bg-hover text-text-secondary hover:text-text-primary',
  danger: 'bg-status-failed hover:bg-status-failed/90 text-white',
  success: 'bg-status-success hover:bg-status-success/90 text-white',
  outline: 'bg-transparent border border-border hover:border-border-hover hover:bg-bg-hover text-text-primary',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-9 w-9 p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={classNames(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
          'disabled:opacity-50 disabled:pointer-events-none',
          'active:scale-[0.98]',
          VARIANTS[variant],
          SIZES[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)
Button.displayName = 'Button'
