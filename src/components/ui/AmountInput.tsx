// ============================================================================
// components/ui/AmountInput.tsx — Numeric input with max button and decimals
// ============================================================================

import { forwardRef } from 'react'
import { classNames } from '@/utils/helpers'
import { Input } from './Input'

export interface AmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  error?: string
  hint?: string
  symbol?: string
  max?: number  // raw amount
  onMaxClick?: () => void
  onChange?: (value: string) => void
  decimals?: number
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ className, label, error, hint, symbol, max, onMaxClick, onChange, decimals = 6, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        label={label}
        error={error}
        hint={hint ?? (max !== undefined ? `Available: ${(max / Math.pow(10, decimals)).toLocaleString('en-US', { maximumFractionDigits: decimals })} ${symbol ?? ''}` : undefined)}
        type="number"
        step="any"
        inputMode="decimal"
        placeholder="0.0"
        className={classNames('font-mono', className)}
        rightAdornment={
          <div className="flex items-center gap-1">
            {max !== undefined && onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="px-1.5 py-0.5 text-[10px] font-semibold text-accent-blue hover:bg-accent-blue/10 rounded transition-colors"
              >
                MAX
              </button>
            )}
            {symbol && (
              <span className="text-xs font-medium text-text-secondary">{symbol}</span>
            )}
          </div>
        }
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
    )
  }
)
AmountInput.displayName = 'AmountInput'
