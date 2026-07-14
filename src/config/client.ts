// ============================================================================
// config/client.ts — RPC client configuration and singleton accessor
// ============================================================================

import { NETWORKS, DEFAULT_NETWORK } from './networks'
import type { NetworkId } from '@/types'

// Default fee (in OU) for various operation types.
// `ou` is a BID/CAP, not the actual fee charged. The network charges based
// on actual computation effort (see `contract_receipt.effort`). 1 OCT = 1M OU.
// Recommended: query `octra_recommendedFee(op_type)` for the actual bid to use.
export const DEFAULT_OU = {
  CALL: '1000',         // ~0.001 OCT cap
  STANDARD: '10000',    // ~0.01 OCT cap
  DEPLOY: '1000000',    // ~1 OCT cap (was 50M, lowered after fee model analysis)
}

// RPC request timeout (ms)
export const RPC_TIMEOUT = 30_000

// Polling intervals (ms)
export const POLL_INTERVAL = 3_000
export const POLL_MAX_ATTEMPTS = 60   // 3 minutes max

// Cache TTLs (ms) — mirrors octrascan.io client
export const CACHE_TTL = {
  node_status: 5_000,
  balance: 10_000,
  transaction: 5_000,
  vm_contract: 120_000,
  contractAbi: 300_000,
}

// Get current network from localStorage or default
export function getCurrentNetworkId(): NetworkId {
  if (typeof window === 'undefined') return DEFAULT_NETWORK
  const stored = window.localStorage.getItem('octra-safe:network')
  if (stored === 'mainnet' || stored === 'devnet') return stored
  return DEFAULT_NETWORK
}

export function getCurrentNetwork() {
  return NETWORKS[getCurrentNetworkId()]
}

export function setCurrentNetwork(id: NetworkId) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('octra-safe:network', id)
  }
}
