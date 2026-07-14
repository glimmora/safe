// ============================================================================
// components/transaction/TransactionCard.tsx — Card for a single Safe tx
// ============================================================================

import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Clock, AlertCircle, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Button } from '@/components/ui/Button'
import { formatOctAmount } from '@/lib/ocs01'
import { shortAddr, classNames } from '@/utils/helpers'
import type { SafeTransaction } from '@/types'

export interface TransactionCardProps {
  tx: SafeTransaction
  safeAddress: string
  canConfirm?: boolean
  canExecute?: boolean
  hasConfirmed?: boolean
  onConfirm?: () => void
  onExecute?: () => void
}

export function TransactionCard({
  tx,
  safeAddress,
  canConfirm,
  canExecute,
  hasConfirmed,
  onConfirm,
  onExecute,
}: TransactionCardProps) {
  const navigate = useNavigate()

  return (
    <Card hover onClick={() => navigate(`/safe/${safeAddress}/tx/${tx.id}`)} className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={classNames(
            'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
            tx.executed ? 'bg-status-success/10 text-status-success' :
            canExecute ? 'bg-accent-blue/10 text-accent-blue' :
            'bg-status-pending/10 text-status-pending'
          )}>
            {tx.executed ? <Check className="h-4 w-4" /> :
             canExecute ? <ArrowRight className="h-4 w-4" /> :
             <Clock className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {tx.description ?? 'Transaction'}
            </p>
            <p className="text-[10px] text-text-muted">#{tx.id}</p>
          </div>
        </div>
        {tx.executed ? (
          <Badge variant="success" size="sm">Executed</Badge>
        ) : canExecute ? (
          <Badge variant="info" size="sm">Ready</Badge>
        ) : (
          <Badge variant="pending" size="sm">Pending</Badge>
        )}
      </div>

      {/* Details */}
      <div className="text-xs space-y-1.5 pt-2 border-t border-border">
        {/* Hide "To" row for owner-management txs (to is the placeholder) */}
        {tx.kind !== 'add_owner' && tx.kind !== 'remove_owner' && tx.kind !== 'change_threshold' && (
          <div className="flex items-center justify-between">
            <span className="text-text-muted">To</span>
            <AddressDisplay address={tx.to} size="sm" truncate showCopy={false} showLink={false} />
          </div>
        )}
        {tx.value > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Value</span>
            <span className="font-mono text-text-primary">{formatOctAmount(tx.valueRaw)} OCT</span>
          </div>
        )}
      </div>

      {/* Confirmation progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted flex items-center gap-1">
            <Users className="h-3 w-3" />
            Confirmations
          </span>
          <span className={classNames(
            'font-mono font-semibold',
            tx.confirmationCount >= tx.threshold ? 'text-status-success' : 'text-text-secondary'
          )}>
            {tx.confirmationCount} / {tx.threshold}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
          <div
            className={classNames(
              'h-full transition-all duration-300',
              tx.confirmationCount >= tx.threshold ? 'bg-status-success' : 'bg-accent-blue'
            )}
            style={{ width: `${Math.min(100, (tx.confirmationCount / tx.threshold) * 100)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      {(canConfirm || canExecute) && (
        <div className="flex gap-2 pt-2 border-t border-border">
          {canConfirm && !hasConfirmed && (
            <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onConfirm?.() }}>
              Confirm
            </Button>
          )}
          {hasConfirmed && !tx.executed && (
            <Button size="sm" variant="outline" className="flex-1" disabled>
              <Check className="h-3 w-3" /> Confirmed
            </Button>
          )}
          {canExecute && (
            <Button size="sm" variant="success" className="flex-1" onClick={(e) => { e.stopPropagation(); onExecute?.() }}>
              Execute
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
