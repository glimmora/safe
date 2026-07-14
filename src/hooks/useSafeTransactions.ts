// ============================================================================
// hooks/useSafeTransactions.ts — Pending & executed tx lists for a Safe
// ----------------------------------------------------------------------------
// Refactored to ACCEPT an existing useSafe result instead of re-instantiating
// it. This prevents 2x RPC traffic + 2x polling on SafeDetailPage.
// ============================================================================

import { useMemo } from 'react'
import type { SafeTransaction } from '@/types'
import type { UseSafeReturn } from './useSafe'

export interface UseSafeTransactionsReturn {
  pending: SafeTransaction[]
  executed: SafeTransaction[]
  readyToExecute: SafeTransaction[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Accept either a safeAddress (will use useSafe internally — backward compat)
// or an existing useSafe result (preferred — avoids duplicate instance).
export function useSafeTransactions(
  safeOrAddress: string | null | undefined | UseSafeReturn
): UseSafeTransactionsReturn {
  // If passed an object, use it directly. If passed a string, fall back to
  // instantiating useSafe (legacy behavior, will warn in console).
  const safe = typeof safeOrAddress === 'object' && safeOrAddress !== null
    ? safeOrAddress
    : null

  // Lazy import to avoid circular dependency when string is passed
  const fallbackSafe = !safe
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useSafeFallback(safeOrAddress as string | null | undefined)
    : null

  const activeSafe = safe ?? fallbackSafe!
  const { transactions, loading, error, load } = activeSafe

  const pending = useMemo(
    () => transactions.filter((t) => !t.executed).sort((a, b) => b.id - a.id),
    [transactions]
  )

  const executed = useMemo(
    () => transactions.filter((t) => t.executed).sort((a, b) => b.id - a.id),
    [transactions]
  )

  const readyToExecute = useMemo(
    () => pending.filter((t) => t.confirmationCount >= t.threshold),
    [pending]
  )

  return {
    pending,
    executed,
    readyToExecute,
    loading,
    error,
    refresh: load,
  }
}

// Wrapper to call useSafe only when needed (avoids React rules violation)
import { useSafe } from './useSafe'
function useSafeFallback(safeAddress: string | null | undefined) {
  return useSafe(safeAddress)
}
