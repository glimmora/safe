// ============================================================================
// config/networks.ts — Octra network configurations
// ----------------------------------------------------------------------------
// RPC URLs can be overridden via environment variables (see .env.example).
// In development, Vite proxies /rpc/devnet and /rpc/mainnet to the actual
// Octra RPC endpoints to bypass CORS issues.
// In production, the dApp fetches the RPC URLs directly — ensure CORS is
// configured on the RPC server, or deploy behind a reverse proxy.
// ============================================================================

import type { NetworkConfig, NetworkId } from '@/types'

// Detect if we're in dev mode (Vite dev server has proxy configured)
const IS_DEV = import.meta.env.DEV

// Get RPC URL with proxy support for dev, direct URL for prod
function getDevnetRpcUrl(): string {
  // In dev, use the Vite proxy (bypasses CORS)
  if (IS_DEV) return '/rpc/devnet'
  // In prod, use env var or default direct URL
  return import.meta.env.VITE_DEVNET_RPC_URL || 'https://devnet.octrascan.io/rpc'
}

function getMainnetRpcUrl(): string {
  if (IS_DEV) return '/rpc/mainnet'
  return import.meta.env.VITE_MAINNET_RPC_URL || 'https://octra.network/rpc'
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: 'mainnet',
    name: 'Octra Mainnet',
    rpcUrl: getMainnetRpcUrl(),
    explorerUrl: import.meta.env.VITE_MAINNET_EXPLORER_URL || 'https://octrascan.io',
    explorerTxUrl: (hash) =>
      `${import.meta.env.VITE_MAINNET_EXPLORER_URL || 'https://octrascan.io'}/tx.html?hash=${hash}`,
    explorerAddressUrl: (addr) =>
      `${import.meta.env.VITE_MAINNET_EXPLORER_URL || 'https://octrascan.io'}/address.html?addr=${addr}`,
    nativeSymbol: 'OCT',
    nativeDecimals: 6,
    isTestnet: false,
  },
  devnet: {
    id: 'devnet',
    name: 'Octra Devnet',
    rpcUrl: getDevnetRpcUrl(),
    explorerUrl: import.meta.env.VITE_DEVNET_EXPLORER_URL || 'https://devnet.octrascan.io',
    explorerTxUrl: (hash) =>
      `${import.meta.env.VITE_DEVNET_EXPLORER_URL || 'https://devnet.octrascan.io'}/tx.html?hash=${hash}`,
    explorerAddressUrl: (addr) =>
      `${import.meta.env.VITE_DEVNET_EXPLORER_URL || 'https://devnet.octrascan.io'}/address.html?addr=${addr}`,
    nativeSymbol: 'OCT',
    nativeDecimals: 6,
    isTestnet: true,
  },
}

export const DEFAULT_NETWORK: NetworkId = 'devnet'

// Native asset constants
export const NATIVE_DECIMALS = 6
export const NATIVE_SYMBOL = 'OCT'
export const OU_PER_OCT = 1_000_000

// Default fee (in OU = operation units) for various operation types.
// NOTE: `ou` is a MAX CAP / bid, not the actual fee charged. The network
// charges based on actual computation effort (see `contract_receipt.effort`).
// These defaults are conservative caps; actual cost is typically much lower.
// 1 OCT = 1,000,000 OU.
export const DEFAULT_FEES = {
  standard: '10000',     // plain OCT transfer  (~0.01 OCT cap)
  call: '1000',          // contract state-changing call  (~0.001 OCT cap)
  deploy: '1000000',     // contract deployment  (~1 OCT cap)
  program_exec: '1000',
  multi_exec: '8000',
} as const

// Operation type names used in Octra transactions
export const OP_TYPES = {
  STANDARD: 'standard',
  CALL: 'call',
  DEPLOY: 'deploy',
  PROGRAM_EXEC: 'program_exec',
  MULTI_EXEC: 'multi_exec',
  ENCRYPT: 'encrypt',
  DECRYPT: 'decrypt',
  STEALTH: 'stealth',
} as const

// Local storage keys
export const STORAGE_KEYS = {
  network: 'octra-safe:network',
  tokens: 'octra-safe:custom-tokens',
  safes: 'octra-safe:known-safes',
} as const

// Regex for validating Octra addresses
// Format: `oct` + base58 chars (123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz)
// Total length: 47 chars
export const OCTRA_ADDRESS_REGEX = /^oct[1-9A-HJ-NP-Za-km-z]{44}$/
