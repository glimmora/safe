// ============================================================================
// stores/useWalletStore.ts — Global wallet state via zustand
// ----------------------------------------------------------------------------
// CRITICAL: Wallet state MUST be global because useWallet() is called from
// multiple components (ConnectButton, AccountModal, DashboardPage, SafeDetailPage,
// CreateSafeForm, DepositModal, ConfirmButton, AddOwner, RemoveOwner, etc).
// If we use useState locally in the hook, each component gets its own state
// and they don't sync — clicking "Connect" in AccountModal won't update
// ConnectButton because they have separate state instances.
//
// Solution: hold all wallet state in this zustand store. useWallet() becomes
// a thin wrapper that reads from the store + exposes action methods.
// ============================================================================

import { create } from 'zustand'
import type { Balance, NetworkInfo, TransactionResult, DeployResult } from '@/lib/zerozio'

interface WalletStoreState {
  // State
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isAvailable: boolean           // 0xio extension detected?
  isInitialized: boolean         // SDK initWallet() has run?
  balance: Balance | null
  networkId: string | null       // 'mainnet' | 'devnet' | null
  networkInfo: NetworkInfo | null

  // Setters (called by useWallet hook)
  setAddress: (addr: string | null) => void
  setIsConnected: (b: boolean) => void
  setIsConnecting: (b: boolean) => void
  setIsAvailable: (b: boolean) => void
  setIsInitialized: (b: boolean) => void
  setBalance: (b: Balance | null) => void
  setNetworkId: (id: string | null) => void
  setNetworkInfo: (info: NetworkInfo | null) => void

  // Bulk update after connect
  setConnected: (params: {
    address: string
    balance: Balance
    networkInfo: NetworkInfo
  }) => void

  // Reset (disconnect)
  reset: () => void
}

export const useWalletStore = create<WalletStoreState>((set) => ({
  address: null,
  isConnected: false,
  isConnecting: false,
  isAvailable: false,
  isInitialized: false,
  balance: null,
  networkId: null,
  networkInfo: null,

  setAddress: (addr) => set({ address: addr }),
  setIsConnected: (b) => set({ isConnected: b }),
  setIsConnecting: (b) => set({ isConnecting: b }),
  setIsAvailable: (b) => set({ isAvailable: b }),
  setIsInitialized: (b) => set({ isInitialized: b }),
  setBalance: (b) => set({ balance: b }),
  setNetworkId: (id) => set({ networkId: id }),
  setNetworkInfo: (info) => set({ networkInfo: info, networkId: info?.id ?? null }),

  setConnected: (params) => set({
    address: params.address,
    isConnected: true,
    isConnecting: false,
    balance: params.balance,
    networkInfo: params.networkInfo,
    networkId: params.networkInfo.id,
  }),

  reset: () => set({
    address: null,
    isConnected: false,
    isConnecting: false,
    balance: null,
    networkId: null,
    networkInfo: null,
  }),
}))

export type { Balance, NetworkInfo, TransactionResult, DeployResult }
