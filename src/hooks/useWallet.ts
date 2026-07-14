// ============================================================================
// hooks/useWallet.ts — Wallet connection via 0xio extension (GLOBAL STATE)
// ----------------------------------------------------------------------------
// REFACTOR: State sekarang di-shared via useWalletStore (zustand) agar semua
// komponen yang panggil useWallet() share state yang sama. Sebelumnya pakai
// useState lokal → setiap komponen punya state sendiri → bug "tombol connect
// masih ada setelah connect".
//
// Install: https://chromewebstore.google.com/detail/0xio-wallet/anknhjilldkeelailocijnfibefmepcc
// Docs: https://docs.0xio.xyz/
// ============================================================================

import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  initWallet, getWallet, connectWallet, disconnectWallet,
  getConnectionInfo, getBalance, switchNetwork,
  sendNativeOct, callContract, callContractView, signMessage as zeroxioSignMessage,
  deployContract as zeroxioDeployContract,
  is0xioExtensionInstalled,
  ZEROXIO_INSTALL_URL,
  type Balance, type NetworkInfo, type TransactionResult, type DeployResult,
} from '@/lib/zerozio'
import { useWalletStore } from '@/stores/useWalletStore'

export interface WalletHook {
  // State (from global store)
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isAvailable: boolean           // 0xio extension detected?
  balance: Balance | null
  networkId: string | null       // 'mainnet' | 'devnet' | null
  networkInfo: NetworkInfo | null
  // Connection
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
  // Switch network
  switchToNetwork: (id: 'mainnet' | 'devnet') => Promise<void>
  // Signing & tx submission (all via 0xio extension)
  sendTx: (params: { to: string; amount: number | string; message?: string }) => Promise<TransactionResult>
  sendContractCall: (params: {
    contract: string
    method: string
    args: Array<string | number | boolean>
    amount?: string
    ou?: string
  }) => Promise<TransactionResult>
  callView: (params: {
    contract: string
    method: string
    args?: Array<string | number | boolean>
  }) => Promise<unknown>
  deployContract: (params: {
    bytecodeB64: string
    contractAddress: string
    constructorArgs: Array<string | number | boolean>
    ou?: string
  }) => Promise<DeployResult>
  signMessage: (msg: string) => Promise<string>
  // Install info
  installUrl: string
}

// Track whether we've initialized the wallet SDK + event subscriptions
// (singleton — only run once across all hook instances)
let _initDone = false
let _refreshTimer: number | null = null

export function useWallet(): WalletHook {
  // Read state from global store — any component calling useWallet() sees
  // the SAME state, so when AccountModal sets isConnected=true, ConnectButton
  // re-renders and shows the account dropdown.
  const address = useWalletStore((s) => s.address)
  const isConnected = useWalletStore((s) => s.isConnected)
  const isConnecting = useWalletStore((s) => s.isConnecting)
  const isAvailable = useWalletStore((s) => s.isAvailable)
  const isInitialized = useWalletStore((s) => s.isInitialized)
  const balance = useWalletStore((s) => s.balance)
  const networkId = useWalletStore((s) => s.networkId)
  const networkInfo = useWalletStore((s) => s.networkInfo)

  const setConnected = useWalletStore((s) => s.setConnected)
  const setIsConnecting = useWalletStore((s) => s.setIsConnecting)
  const setIsAvailable = useWalletStore((s) => s.setIsAvailable)
  const setIsInitialized = useWalletStore((s) => s.setIsInitialized)
  const setBalance = useWalletStore((s) => s.setBalance)
  const setNetworkInfo = useWalletStore((s) => s.setNetworkInfo)
  const reset = useWalletStore((s) => s.reset)

  const refreshTimerRef = useRef<number | null>(null)

  // --- Initial detect & auto-reconnect (runs ONCE across all instances) ---
  useEffect(() => {
    if (_initDone) return
    _initDone = true

    let cancelled = false

    const init = async () => {
      const { wallet, available } = await initWallet()
      if (cancelled) return

      setIsAvailable(available)
      setIsInitialized(true)
      if (!available || !wallet) return

      // Try to auto-reconnect if user previously approved
      try {
        const info = await wallet.getConnectionStatus()
        if (cancelled) return
        if (info.isConnected && info.address) {
          setConnected({
            address: info.address,
            balance: info.balance ?? { public: 0, total: 0, currency: 'OCT' },
            networkInfo: info.networkInfo ?? {
              id: 'devnet',
              name: 'Devnet',
              rpcUrl: 'https://devnet.octrascan.io/rpc',
              isTestnet: true,
              supportsPrivacy: false,
            } as NetworkInfo,
          })
        }
      } catch (e) {
        console.warn('[useWallet] auto-reconnect check failed', e)
      }

      // Subscribe to wallet events — these update the GLOBAL store so all
      // components re-render automatically.
      const onAccountChanged = (event: any) => {
        const newAddr = event?.data?.newAddress ?? event?.newAddress
        if (newAddr) {
          useWalletStore.getState().setAddress(newAddr)
          toast.info('Account changed', { description: newAddr.slice(0, 12) + '...' })
        }
      }
      const onDisconnect = () => {
        useWalletStore.getState().reset()
        toast.info('Wallet disconnected')
      }
      const onBalanceChanged = (event: any) => {
        const newBal = event?.data?.newBalance ?? event?.newBalance
        if (newBal) useWalletStore.getState().setBalance(newBal)
      }
      const onNetworkChanged = (event: any) => {
        const newNet = event?.data?.newNetwork ?? event?.newNetwork
        if (newNet) {
          useWalletStore.getState().setNetworkInfo(newNet)
          toast.info('Network changed', { description: newNet.name })
        }
      }
      const onExtensionLocked = () => {
        toast.info('0xio wallet locked', { description: 'Unlock it to continue' })
      }
      const onExtensionUnlocked = () => {
        // Refresh state after unlock — read fresh from store
        const store = useWalletStore.getState()
        if (store.isConnected) {
          store.setBalance
          getBalance(true).then((b) => { if (b) store.setBalance(b) }).catch(() => {})
        }
      }

      wallet.on('accountChanged', onAccountChanged)
      wallet.on('disconnect', onDisconnect)
      wallet.on('balanceChanged', onBalanceChanged)
      wallet.on('networkChanged', onNetworkChanged)
      wallet.on('extensionLocked', onExtensionLocked)
      wallet.on('extensionUnlocked', onExtensionUnlocked)

      // Note: we intentionally don't unsubscribe — the wallet instance is a
      // singleton that lives for the page lifetime.
    }

    init()
    return () => { cancelled = true }
  }, [setIsAvailable, setIsInitialized, setConnected])

  // --- Auto-refresh balance every 30s when connected ---
  useEffect(() => {
    if (!isConnected) return

    const doRefresh = async () => {
      try {
        const [bal, info] = await Promise.all([getBalance(true), getConnectionInfo()])
        if (bal) setBalance(bal)
        if (info.networkInfo) setNetworkInfo(info.networkInfo)
      } catch (e) {
        console.warn('[useWallet] refresh failed', e)
      }
    }

    doRefresh()
    refreshTimerRef.current = window.setInterval(doRefresh, 30000)
    if (_refreshTimer === null) _refreshTimer = refreshTimerRef.current
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [isConnected, setBalance, setNetworkInfo])

  // --- Connect ---
  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      if (!is0xioExtensionInstalled()) {
        toast.error('0xio wallet not detected', {
          description: 'Install the Chrome extension to continue',
          action: {
            label: 'Install',
            onClick: () => window.open(ZEROXIO_INSTALL_URL, '_blank'),
          },
          duration: 8000,
        })
        return
      }
      const result = await connectWallet()
      // Update GLOBAL store — this triggers re-render in ALL components
      // that read from useWalletStore (including ConnectButton)
      setConnected({
        address: result.address,
        balance: result.balance,
        networkInfo: result.networkInfo,
      })
      toast.success('Connected to 0xio wallet', {
        description: result.address.slice(0, 12) + '...' + result.address.slice(-6),
      })
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg.includes('USER_REJECTED') || msg.includes('rejected')) {
        toast.error('Connection rejected')
      } else if (msg.includes('WALLET_LOCKED') || msg.includes('locked')) {
        toast.error('0xio wallet is locked', { description: 'Unlock it and try again' })
      } else {
        toast.error('Failed to connect', { description: msg })
      }
    } finally {
      setIsConnecting(false)
    }
  }, [setConnected, setIsConnecting])

  // --- Disconnect ---
  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet()
    } catch (e) {
      console.warn('[useWallet] disconnect failed', e)
    }
    reset()
    toast.info('Wallet disconnected')
  }, [reset])

  // --- Refresh balance & connection status ---
  const refresh = useCallback(async () => {
    const store = useWalletStore.getState()
    if (!store.isConnected) return
    try {
      const [bal, info] = await Promise.all([getBalance(true), getConnectionInfo()])
      if (bal) store.setBalance(bal)
      if (info.networkInfo) store.setNetworkInfo(info.networkInfo)
    } catch (e) {
      console.warn('[useWallet] refresh failed', e)
    }
  }, [])

  // --- Switch network ---
  const switchToNetwork = useCallback(async (id: 'mainnet' | 'devnet') => {
    try {
      await switchNetwork(id)
      toast.success(`Switched to ${id === 'mainnet' ? 'Mainnet' : 'Devnet'}`)
      refresh()
    } catch (e: any) {
      toast.error('Failed to switch network', { description: e?.message })
    }
  }, [refresh])

  // --- Send native OCT ---
  const sendTx = useCallback(async (params: {
    to: string
    amount: number | string
    message?: string
  }): Promise<TransactionResult> => {
    if (!isConnected) throw new Error('Wallet not connected')
    return sendNativeOct(params)
  }, [isConnected])

  // --- Send contract call ---
  const sendContractCall = useCallback(async (params: {
    contract: string
    method: string
    args: Array<string | number | boolean>
    amount?: string
    ou?: string
  }): Promise<TransactionResult> => {
    if (!isConnected) throw new Error('Wallet not connected')
    return callContract(params)
  }, [isConnected])

  // --- Read-only contract view ---
  const callView = useCallback(async (params: {
    contract: string
    method: string
    args?: Array<string | number | boolean>
  }): Promise<unknown> => {
    return callContractView(params)
  }, [])

  // --- Sign arbitrary message ---
  const signMessage = useCallback(async (msg: string): Promise<string> => {
    if (!isConnected) throw new Error('Wallet not connected')
    return zeroxioSignMessage(msg)
  }, [isConnected])

  // --- Deploy smart contract ---
  const deployContract = useCallback(async (params: {
    bytecodeB64: string
    contractAddress: string
    constructorArgs: Array<string | number | boolean>
    ou?: string
  }): Promise<DeployResult> => {
    if (!isConnected) throw new Error('Wallet not connected')
    return zeroxioDeployContract(params)
  }, [isConnected])

  return {
    address,
    isConnected,
    isConnecting,
    isAvailable,
    balance,
    networkId,
    networkInfo,
    connect,
    disconnect,
    refresh,
    switchToNetwork,
    sendTx,
    sendContractCall,
    callView,
    deployContract,
    signMessage,
    installUrl: ZEROXIO_INSTALL_URL,
  }
}
