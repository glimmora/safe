// ============================================================================
// components/transaction/TransactionList.tsx — List of Safe transactions
// ============================================================================

import { Clock, History } from 'lucide-react'
import { TransactionCard } from './TransactionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import type { SafeTransaction } from '@/types'

export interface TransactionListProps {
  transactions: SafeTransaction[]
  safeAddress: string
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ReactNode
  canConfirm?: (tx: SafeTransaction) => boolean
  canExecute?: (tx: SafeTransaction) => boolean
  hasConfirmed?: (tx: SafeTransaction) => boolean
  onConfirm?: (tx: SafeTransaction) => void
  onExecute?: (tx: SafeTransaction) => void
}

export function TransactionList({
  transactions,
  safeAddress,
  loading,
  emptyTitle = 'No transactions',
  emptyDescription = 'There are no transactions in this view yet.',
  emptyIcon,
  canConfirm,
  canExecute,
  hasConfirmed,
  onConfirm,
  onExecute,
}: TransactionListProps) {
  if (loading && transactions.length === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon ?? <Clock className="h-6 w-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {transactions.map((tx) => (
        <TransactionCard
          key={tx.id}
          tx={tx}
          safeAddress={safeAddress}
          canConfirm={canConfirm?.(tx)}
          canExecute={canExecute?.(tx)}
          hasConfirmed={hasConfirmed?.(tx)}
          onConfirm={() => onConfirm?.(tx)}
          onExecute={() => onExecute?.(tx)}
        />
      ))}
    </div>
  )
}
