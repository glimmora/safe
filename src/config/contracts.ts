// ============================================================================
// config/contracts.ts — Deployed contract addresses and known OCS01 tokens
// ----------------------------------------------------------------------------
// Addresses can be set via environment variables (VITE_DEVNET_TEST_TOKEN_ADDR,
// etc.) OR hardcoded here after deployment.
// ============================================================================

import type { TokenInfo } from '@/types'

// ---------------------------------------------------------------------------
// Deployed contract addresses per network.
// Override via env vars (see .env.example) or hardcode here.
// ---------------------------------------------------------------------------
export const CONTRACT_ADDRESSES = {
  mainnet: {
    factory: import.meta.env.VITE_MAINNET_FACTORY_ADDR || '',
    testToken: import.meta.env.VITE_MAINNET_TEST_TOKEN_ADDR || '',
  },
  devnet: {
    factory: import.meta.env.VITE_DEVNET_FACTORY_ADDR || '',
    testToken: import.meta.env.VITE_DEVNET_TEST_TOKEN_ADDR || '',
  },
} as const

// ---------------------------------------------------------------------------
// Known OCS01 tokens per network.
// If testToken address is set (via env or hardcoded), it's auto-added here.
// ---------------------------------------------------------------------------
function buildKnownTokens(network: 'mainnet' | 'devnet'): TokenInfo[] {
  const tokens: TokenInfo[] = []
  const testTokenAddr = CONTRACT_ADDRESSES[network].testToken
  if (testTokenAddr) {
    tokens.push({
      address: testTokenAddr,
      name: 'TestOCS01',
      symbol: 'TEST',
      decimals: 6,
    })
  }
  return tokens
}

export const KNOWN_TOKENS: Record<string, TokenInfo[]> = {
  mainnet: buildKnownTokens('mainnet'),
  devnet: buildKnownTokens('devnet'),
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
