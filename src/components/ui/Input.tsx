// ============================================================================
// components/ui/Input.tsx — Text input with label and error states
// ============================================================================

import { forwardRef } from 'react'
import { classNames } from '@/utils/helpers'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftAdornment?: React.ReactNode
  rightAdornment?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftAdornment, rightAdornment, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftAdornment && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {leftAdornment}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={classNames(
              'w-full h-11 rounded-xl bg-bg-subtle border border-border px-3 text-sm text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:border-accent-blue/60 focus:ring-2 focus:ring-accent-blue/20',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftAdornment ? 'pl-10' : '',
              rightAdornment ? 'pr-10' : '',
              error && 'border-status-failed focus:border-status-failed focus:ring-status-failed/20',
              className
            )}
            {...props}
          />
          {rightAdornment && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {rightAdornment}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-status-failed">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={classNames(
            'w-full min-h-[80px] rounded-xl bg-bg-subtle border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-accent-blue/60 focus:ring-2 focus:ring-accent-blue/20',
            'transition-all duration-200 resize-y',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-status-failed focus:border-status-failed focus:ring-status-failed/20',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-status-failed">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
