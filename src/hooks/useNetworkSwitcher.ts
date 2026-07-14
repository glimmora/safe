// ============================================================================
// hooks/useNetworkSwitcher.ts — Switch between Octra mainnet and devnet
// ============================================================================

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore, useNetwork } from '@/stores/useAppStore'
import { clearCache } from '@/lib/rpc'
import type { NetworkId } from '@/types'

export interface UseNetworkSwitcherReturn {
  networkId: NetworkId
  network: ReturnType<typeof useNetwork>
  switchNetwork: (id: NetworkId) => void
}

export function useNetworkSwitcher(): UseNetworkSwitcherReturn {
  const networkId = useAppStore((s) => s.networkId)
  const setNetworkId = useAppStore((s) => s.setNetworkId)
  const network = useNetwork()

  const switchNetwork = useCallback((id: NetworkId) => {
    clearCache()
    setNetworkId(id)
    toast.success(`Switched to ${id === 'mainnet' ? 'Mainnet' : 'Devnet'}`)
  }, [setNetworkId])

  return {
    networkId,
    network,
    switchNetwork,
  }
}
