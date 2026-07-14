// ============================================================================
// config/contracts.ts — Deployed contract addresses and known OCS01 tokens
// ----------------------------------------------------------------------------
// IMPORTANT: Update these addresses after deploying contracts to devnet.
// See README.md for deployment instructions.
// ============================================================================

import type { TokenInfo } from '@/types'

// ---------------------------------------------------------------------------
// Deployed contract addresses per network.
// Replace with actual addresses after running the deploy flow.
// ---------------------------------------------------------------------------
export const CONTRACT_ADDRESSES = {
  mainnet: {
    factory: '',  // TODO: deploy OctraSafeFactory to mainnet, paste address here
    testToken: '', // TODO: deploy TestOCS01 to mainnet, paste address here
  },
  devnet: {
    factory: '',  // TODO: deploy OctraSafeFactory to devnet, paste address here
    testToken: '', // TODO: deploy TestOCS01 to devnet, paste address here
  },
} as const

// ---------------------------------------------------------------------------
// Known OCS01 tokens per network.
// Add token addresses here after deploying them.
// ---------------------------------------------------------------------------
export const KNOWN_TOKENS: Record<string, TokenInfo[]> = {
  mainnet: [
    // Example:
    // {
    //   address: 'oct...',
    //   name: 'TestOCS01',
    //   symbol: 'TEST',
    //   decimals: 6,
    // },
  ],
  devnet: [
    // The TestOCS01 token will be added here after deployment.
    // Example:
    // {
    //   address: 'oct...',
    //   name: 'TestOCS01',
    //   symbol: 'TEST',
    //   decimals: 6,
    // },
  ],
}

// Helper: get factory address for the current network
export function getFactoryAddress(network: 'mainnet' | 'devnet'): string {
  return CONTRACT_ADDRESSES[network].factory
}

// Helper: get known tokens for a network
export function getKnownTokens(network: 'mainnet' | 'devnet'): TokenInfo[] {
  return KNOWN_TOKENS[network] ?? []
}

// Helper: get test token address for a network
export function getTestTokenAddress(network: 'mainnet' | 'devnet'): string {
  return CONTRACT_ADDRESSES[network].testToken
}
