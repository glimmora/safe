// ============================================================================
// hooks/useSafe.ts — Read OctraSafe multi-sig contract state
// ----------------------------------------------------------------------------
// Wraps the OctraSafe.aml view functions:
//   get_owners, get_threshold, get_transaction_count, get_owner_count,
//   get_transaction, get_confirmation_count, is_confirmed_by, is_owner,
//   get_safe_balance
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useNetwork } from '@/stores/useAppStore'
import { contractCall } from '@/lib/rpc'
import { decodeAddressList, decodeInt, decodeString, decodeBool, decodeTransactionRecord } from '@/lib/encoder'
import { SAFE_FUNCTIONS } from '@/types'
import { getBalance } from '@/lib/rpc'
import type { SafeInfo, SafeTransaction } from '@/types'
import { describeTransaction } from '@/lib/txDecoder'
import { useAppStore } from '@/stores/useAppStore'

export interface UseSafeReturn {
  loading: boolean
  error: string | null
  safeInfo: SafeInfo | null
  transactions: SafeTransaction[]
  load: () => Promise<void>
  isOwner: (addr: string) => Promise<boolean>
  refreshTx: (txId: number) => Promise<SafeTransaction | null>
}

export function useSafe(safeAddress: string | null | undefined): UseSafeReturn {
  const network = useNetwork()
  const tokens = useAppStore((s) => s.tokens)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null)
  const [transactions, setTransactions] = useState<SafeTransaction[]>([])

  const load = useCallback(async () => {
    if (!safeAddress) {
      setSafeInfo(null)
      setTransactions([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Parallel fetch core info
      const [ownersCsv, threshold, ownerCount, txCount, balanceResult] = await Promise.all([
        contractCall<string>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getOwners, []).catch(() => ''),
        contractCall<string | number>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getThreshold, []).then(decodeInt).catch(() => 1),
        contractCall<string | number>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getOwnerCount, []).then(decodeInt).catch(() => 0),
        contractCall<string | number>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getTransactionCount, []).then(decodeInt).catch(() => 0),
        getBalance(network.rpcUrl, safeAddress).catch(() => null),
      ])

      const owners = decodeAddressList(ownersCsv)

      const info: SafeInfo = {
        address: safeAddress,
        owners,
        threshold,
        ownerCount,
        balance: balanceResult ? parseFloat(balanceResult.balance) : 0,
        balanceRaw: balanceResult ? balanceResult.balance_raw : '0',
        pendingTxCount: 0, // computed below
      }

      // Fetch all transactions IN PARALLEL (was sequential — caused 30s+ loads)
      const fetchLimit = Math.min(txCount, 50) // cap to first 50 for performance
      const txIds = Array.from({ length: fetchLimit }, (_, i) => fetchLimit - 1 - i) // newest first

      const txList: SafeTransaction[] = []
      const txResults = await Promise.all(
        txIds.map(async (txId) => {
          try {
            const record = await contractCall<string>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getTransaction, [txId])
            const decoded = decodeTransactionRecord(record)
            const confCount = await contractCall<string | number>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getConfirmationCount, [txId]).then(decodeInt).catch(() => 0)

            // Fetch confirmation status for each owner IN PARALLEL
            const confirmationResults = await Promise.all(
              owners.map(async (owner) => {
                try {
                  const confirmed = await contractCall<string | boolean>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.isConfirmedBy, [txId, owner]).then(decodeBool)
                  return confirmed ? owner : null
                } catch {
                  return null
                }
              })
            )
            const confirmations = confirmationResults.filter((o): o is string => o !== null)

            const valueNum = parseInt(decoded.value, 10) || 0
            const partial = {
              id: txId,
              to: decoded.to,
              value: valueNum / 1_000_000, // OU to OCT
              valueRaw: decoded.value,
              data: decoded.data,
              executed: decoded.executed,
              confirmations,
              confirmationCount: confCount,
              threshold,
            }
            const desc = describeTransaction(partial, tokens)
            return {
              ...partial,
              description: desc.description,
              kind: desc.kind,
            } as SafeTransaction
          } catch (e) {
            console.warn(`Failed to fetch tx ${txId}`, e)
            return null
          }
        })
      )

      for (const tx of txResults) {
        if (tx) txList.push(tx)
      }

      info.pendingTxCount = txList.filter((t) => !t.executed).length
      setSafeInfo(info)
      setTransactions(txList)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Safe')
      setSafeInfo(null)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [safeAddress, network.rpcUrl, tokens])

  // Auto-load when safeAddress changes
  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh every 15s
  useEffect(() => {
    if (!safeAddress) return
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [safeAddress, load])

  const isOwner = useCallback(async (addr: string): Promise<boolean> => {
    if (!safeAddress) return false
    try {
      return await contractCall<string | boolean>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.isOwner, [addr]).then(decodeBool)
    } catch {
      return false
    }
  }, [safeAddress, network.rpcUrl])

  const refreshTx = useCallback(async (txId: number): Promise<SafeTransaction | null> => {
    if (!safeAddress) return null
    try {
      const record = await contractCall<string>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getTransaction, [txId])
      const decoded = decodeTransactionRecord(record)
      const confCount = await contractCall<string | number>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.getConfirmationCount, [txId]).then(decodeInt)
      const owners = safeInfo?.owners ?? []
      const confirmations: string[] = []
      for (const owner of owners) {
        try {
          const c = await contractCall<string | boolean>(network.rpcUrl, safeAddress, SAFE_FUNCTIONS.isConfirmedBy, [txId, owner]).then(decodeBool)
          if (c) confirmations.push(owner)
        } catch {
          // skip
        }
      }
      const valueNum = parseInt(decoded.value, 10) || 0
      const partial = {
        id: txId,
        to: decoded.to,
        value: valueNum / 1_000_000,
        valueRaw: decoded.value,
        data: decoded.data,
        executed: decoded.executed,
        confirmations,
        confirmationCount: confCount,
        threshold: safeInfo?.threshold ?? 1,
      }
      const desc = describeTransaction(partial, tokens)
      const updated: SafeTransaction = {
        ...partial,
        description: desc.description,
        kind: desc.kind,
      }
      setTransactions((prev) => prev.map((t) => (t.id === txId ? updated : t)))
      return updated
    } catch (e) {
      console.warn(`refreshTx(${txId}) failed`, e)
      return null
    }
  }, [safeAddress, network.rpcUrl, safeInfo, tokens])

  return {
    loading,
    error,
    safeInfo,
    transactions,
    load,
    isOwner,
    refreshTx,
  }
}
