// ============================================================================
// components/transaction/TransactionDetail.tsx — Detail view for a Safe tx
// ============================================================================

import { ArrowRight, Check, Clock, X, Users, Hash, FileJson, History } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { useNetwork } from '@/stores/useAppStore'
import { formatOctAmount } from '@/lib/ocs01'
import { formatTimeAgo } from '@/utils/helpers'
import { classNames } from '@/utils/helpers'
import type { SafeTransaction } from '@/types'

export interface TransactionDetailProps {
  tx: SafeTransaction
  safeAddress: string
  canConfirm?: boolean
  canExecute?: boolean
  canRevoke?: boolean
  hasConfirmed?: boolean
  isOwner?: boolean
  onConfirm?: () => void
  onExecute?: () => void
  onRevoke?: () => void
}

export function TransactionDetail({
  tx,
  safeAddress,
  canConfirm,
  canExecute,
  canRevoke,
  hasConfirmed,
  isOwner,
  onConfirm,
  onExecute,
  onRevoke,
}: TransactionDetailProps) {
  const network = useNetwork()

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              tx.executed ? 'bg-status-success/10 text-status-success' :
              canExecute ? 'bg-accent-blue/10 text-accent-blue' :
              'bg-status-pending/10 text-status-pending'
            )}>
              {tx.executed ? <Check className="h-6 w-6" /> :
               canExecute ? <ArrowRight className="h-6 w-6" /> :
               <Clock className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Transaction #{tx.id}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">{tx.description}</p>
            </div>
          </div>
          {tx.executed ? (
            <Badge variant="success">Executed</Badge>
          ) : canExecute ? (
            <Badge variant="info">Ready to Execute</Badge>
          ) : (
            <Badge variant="pending">Pending</Badge>
          )}
        </div>

        {/* Action buttons */}
        {isOwner && !tx.executed && (
          <div className="flex gap-2 pt-3 border-t border-border">
            {canConfirm && !hasConfirmed && (
              <Button onClick={onConfirm} className="flex-1">
                <Check className="h-4 w-4" />
                Confirm Transaction
              </Button>
            )}
            {hasConfirmed && canRevoke && (
              <Button variant="outline" onClick={onRevoke} className="flex-1">
                <X className="h-4 w-4" />
                Revoke Confirmation
              </Button>
            )}
            {canExecute && (
              <Button variant="success" onClick={onExecute} className="flex-1">
                <ArrowRight className="h-4 w-4" />
                Execute Transaction
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Transaction details */}
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Hash className="h-4 w-4 text-text-muted" />
          Details
        </h3>
        <div className="space-y-2.5">
          <DetailRow label="Transaction ID" value={`#${tx.id}`} />
          <DetailRow
            label="Recipient"
            value={<AddressDisplay address={tx.to} size="sm" />}
          />
          {tx.value > 0 && (
            <DetailRow
              label="Value"
              value={<span className="font-mono text-text-primary">{formatOctAmount(tx.valueRaw)} OCT</span>}
            />
          )}
          <DetailRow
            label="Action"
            value={
              tx.data ? (
                <span className="text-xs text-text-secondary font-mono">
                  {tx.data.split(':')[0]}:
                </span>
              ) : (
                <span className="text-xs text-text-muted">Native transfer</span>
              )
            }
          />
          {tx.txHash && (
            <DetailRow
              label="Tx Hash"
              value={
                <a
                  href={network.explorerTxUrl(tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-accent-blue hover:underline break-all"
                >
                  {tx.txHash}
                </a>
              }
            />
          )}
        </div>
      </Card>

      {/* Confirmations */}
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Users className="h-4 w-4 text-text-muted" />
          Confirmations
          <Badge variant={tx.confirmationCount >= tx.threshold ? 'success' : 'pending'}>
            {tx.confirmationCount} / {tx.threshold}
          </Badge>
        </h3>
        <div className="space-y-2">
          {tx.confirmations.length > 0 ? (
            tx.confirmations.map((addr) => (
              <div
                key={addr}
                className="flex items-center justify-between p-2.5 rounded-lg bg-bg-subtle border border-border"
              >
                <AddressDisplay address={addr} size="sm" />
                <Badge variant="success" size="sm">
                  <Check className="h-3 w-3" /> Confirmed
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted text-center py-4">No confirmations yet</p>
          )}
        </div>
      </Card>

      {/* Raw data */}
      {tx.data && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileJson className="h-4 w-4 text-text-muted" />
            Raw Action Data
          </h3>
          <pre className="text-xs font-mono text-text-secondary bg-bg-subtle p-3 rounded-lg overflow-x-auto break-all whitespace-pre-wrap">
            {tx.data}
          </pre>
        </Card>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <div className="text-right min-w-0">{value}</div>
    </div>
  )
}
