// ============================================================================
// hooks/useTokenBalance.ts — Read OCS-01 token balance for a wallet
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useNetwork } from '@/stores/useAppStore'
import { getTokenBalance } from '@/lib/ocs01'
import { formatTokenAmount } from '@/lib/ocs01'
import type { TokenInfo } from '@/types'

export interface UseTokenBalanceReturn {
  balance: number | null       // raw integer
  formatted: string            // human-readable (e.g. "1.5")
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTokenBalance(
  token: TokenInfo | null | undefined,
  walletAddress: string | null | undefined
): UseTokenBalanceReturn {
  const network = useNetwork()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token || !walletAddress) {
      setBalance(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const bal = await getTokenBalance(network.rpcUrl, token.address, walletAddress)
      setBalance(bal)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load balance')
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [token, walletAddress, network.rpcUrl])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!token || !walletAddress) return
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [token, walletAddress, refresh])

  const formatted = balance !== null && token ? formatTokenAmount(balance, token.decimals) : '0'

  return {
    balance,
    formatted,
    loading,
    error,
    refresh,
  }
}

// Hook for fetching multiple token balances at once
export function useTokenBalances(
  tokens: TokenInfo[],
  walletAddress: string | null | undefined
) {
  const network = useNetwork()
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!walletAddress || tokens.length === 0) {
      setBalances({})
      return
    }
    setLoading(true)
    try {
      const entries = await Promise.all(
        tokens.map(async (t) => {
          try {
            const bal = await getTokenBalance(network.rpcUrl, t.address, walletAddress)
            return [t.address, bal] as const
          } catch {
            return [t.address, 0] as const
          }
        })
      )
      const map: Record<string, number> = {}
      for (const [addr, bal] of entries) map[addr] = bal
      setBalances(map)
    } finally {
      setLoading(false)
    }
  }, [tokens, walletAddress, network.rpcUrl])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!walletAddress || tokens.length === 0) return
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [tokens, walletAddress, refresh])

  return { balances, loading, refresh }
}
