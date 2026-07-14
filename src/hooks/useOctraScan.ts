// ============================================================================
// hooks/useOctraScan.ts — OctraScan explorer API helpers
// ----------------------------------------------------------------------------
// OctraScan does NOT expose a REST `/api` surface — all reads go through
// the JSON-RPC endpoint. This hook wraps common explorer queries:
//   - Transaction history for an address
//   - Contract metadata
//   - Search by hash/address
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useNetwork } from '@/stores/useAppStore'
import { getTransactionsByAddress, getVmContract, getTransaction, type OctraTransaction, type VmContract } from '@/lib/rpc'

export interface UseOctraScanReturn {
  loading: boolean
  error: string | null
}

// Fetch tx history for an address (paginated)
export function useAddressTransactions(address: string | null | undefined, limit = 20) {
  const network = useNetwork()
  const [txs, setTxs] = useState<OctraTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setTxs([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await getTransactionsByAddress(network.rpcUrl, address, limit, 0)
      setTxs(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions')
      setTxs([])
    } finally {
      setLoading(false)
    }
  }, [address, network.rpcUrl, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { txs, loading, error, refresh }
}

// Fetch contract metadata
export function useContractMetadata(address: string | null | undefined) {
  const network = useNetwork()
  const [contract, setContract] = useState<VmContract | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!address) {
      setContract(null)
      return
    }
    setLoading(true)
    try {
      const c = await getVmContract(network.rpcUrl, address)
      setContract(c)
    } catch {
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [address, network.rpcUrl])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { contract, loading, refresh }
}

// Watch a single transaction (polls for status changes)
export function useTransactionWatcher(txHash: string | null | undefined) {
  const network = useNetwork()
  const [tx, setTx] = useState<OctraTransaction | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!txHash) {
      setTx(null)
      return
    }
    setLoading(true)
    let cancelled = false

    const poll = async () => {
      try {
        const result = await getTransaction(network.rpcUrl, txHash)
        if (cancelled) return
        setTx(result)
        if (!result || result.status === 'pending') {
          setTimeout(poll, 3000)
        } else {
          setLoading(false)
        }
      } catch (e) {
        if (cancelled) return
        console.warn('tx watch error', e)
        setTimeout(poll, 5000)
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [txHash, network.rpcUrl])

  return { tx, loading }
}
