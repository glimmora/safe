// ============================================================================
// components/transaction/NewTransactionForm.tsx — Multi-type tx form
// ============================================================================

import { useState } from 'react'
import { ArrowLeft, Coins, Send, Code, Shield } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SendNativeForm } from './SendNativeForm'
import { SendTokenForm } from './SendTokenForm'
import { GrantTokenForm } from './GrantTokenForm'
import { classNames } from '@/utils/helpers'

type TxType = 'native' | 'token' | 'grant' | 'custom'

const TX_TYPES = [
  { id: 'native' as const, label: 'Send OCT', icon: Send, desc: 'Transfer native Octra tokens' },
  { id: 'token' as const, label: 'Send Token', icon: Coins, desc: 'Transfer OCS-01 tokens' },
  { id: 'grant' as const, label: 'Approve Token', icon: Shield, desc: 'Allow spender to use Safe tokens (OCS-01 grant)' },
  { id: 'custom' as const, label: 'Custom Call', icon: Code, desc: 'Call arbitrary contract method (advanced)' },
]

export interface NewTransactionFormProps {
  safeAddress: string
  safeBalance: number  // in OU
  threshold?: number
  onSubmitted?: (txId: number) => void
  onCancel?: () => void
}

export function NewTransactionForm({ safeAddress, safeBalance, threshold, onSubmitted, onCancel }: NewTransactionFormProps) {
  const [txType, setTxType] = useState<TxType | null>(null)

  if (txType === null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">New Transaction</h2>
            <p className="text-xs text-text-secondary">
              Choose the type of transaction to create
              {threshold !== undefined && (
                <span className="ml-1">· requires {threshold} confirmation{threshold > 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {TX_TYPES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTxType(t.id)}
                className="text-left p-4 rounded-xl bg-bg-card border border-border hover:border-accent-blue/40 hover:bg-bg-hover/50 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue mb-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">{t.label}</h3>
                <p className="text-xs text-text-secondary mt-1">{t.desc}</p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTxType(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold text-text-primary">
            {TX_TYPES.find((t) => t.id === txType)?.label}
          </h2>
        </div>
      </div>

      {txType === 'native' && (
        <SendNativeForm
          safeAddress={safeAddress}
          safeBalance={safeBalance}
          threshold={threshold}
          onSubmitted={onSubmitted}
          onCancel={onCancel}
        />
      )}

      {txType === 'token' && (
        <SendTokenForm
          safeAddress={safeAddress}
          threshold={threshold}
          onSubmitted={onSubmitted}
          onCancel={onCancel}
        />
      )}

      {txType === 'grant' && (
        <GrantTokenForm
          safeAddress={safeAddress}
          onSubmitted={onSubmitted}
          onCancel={onCancel}
        />
      )}

      {txType === 'custom' && (
        <Card className="space-y-3">
          <p className="text-xs text-text-secondary">
            Custom contract calls let advanced users target any contract method with arbitrary data.
            This is intended for developers familiar with the Octra AML contract ABI.
          </p>
          <p className="text-xs text-text-muted">
            The OctraSafe contract dispatches based on the <code className="text-accent-cyan">data</code> field format:
            <ul className="list-disc ml-5 mt-2 space-y-0.5">
              <li><code className="text-accent-cyan">add_owner:addr</code> — add owner</li>
              <li><code className="text-accent-cyan">remove_owner:addr</code> — remove owner</li>
              <li><code className="text-accent-cyan">change_threshold:N</code> — change threshold</li>
              <li><code className="text-accent-cyan">transfer:addr:amount</code> — OCS-01 token transfer (to=token addr)</li>
              <li><code className="text-accent-cyan">grant:addr:amount</code> — OCS-01 token grant (to=token addr)</li>
            </ul>
            Use the dedicated forms above for these — they handle encoding for you.
          </p>
          <Button variant="outline" onClick={() => setTxType('native')}>
            Use Send OCT instead
          </Button>
        </Card>
      )}
    </div>
  )
}
