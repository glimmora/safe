// ============================================================================
// hooks/useWallet.ts — Wallet connection, signing, transaction submission
// ----------------------------------------------------------------------------
// Octra uses ED25519 keys (NOT MetaMask/secp256k1). This hook manages:
//   - Creating a new wallet (generates ed25519 keypair + mnemonic)
//   - Importing wallet from mnemonic or private key
//   - Unlocking an existing wallet (decrypts AES-GCM blob in localStorage)
//   - Locking (clears in-memory secret key)
//   - Signing & submitting Octra transactions
//   - Fetching balance & nonce
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import nacl from 'tweetnacl'
import { useAppStore } from '@/stores/useAppStore'
import { useNetwork } from '@/stores/useAppStore'
import {
  generateKeyPair, generateMnemonic, mnemonicToKeyPair, keyPairFromSecretKey,
  addressFromPublicKeySync, encryptWallet, decryptWallet, saveEncryptedWallet,
  loadEncryptedWallet, clearEncryptedWallet, encodeBase64, decodeBase64,
  signTransaction, signedTxToSubmitPayload, type EncryptedWallet,
} from '@/lib/signer'
import { getBalance, getNonce, submitTransaction, waitForTransaction } from '@/lib/rpc'
import { buildCanonicalTxJson, encodeCallMessage } from '@/lib/encoder'
import type { OctraTx } from '@/types'
import type { OctraTransaction } from '@/lib/rpc'

export interface WalletHook {
  // State
  address: string | null
  isUnlocked: boolean
  balance: number | null
  balanceRaw: string | null
  nonce: number | null
  hasWallet: boolean
  isLoading: boolean
  // Lifecycle
  createWallet: (password: string) => Promise<{ address: string; mnemonic: string }>
  importFromMnemonic: (mnemonic: string, password: string) => Promise<string>
  importFromPrivateKey: (privateKeyB64: string, password: string) => Promise<string>
  unlock: (password: string) => Promise<string>
  lock: () => void
  disconnect: () => void
  // Balance / nonce refresh
  refresh: () => Promise<void>
  // Signing
  signTx: (tx: OctraTx) => OctraTx | null
  sendTx: (tx: OctraTx) => Promise<{ txHash: string }>
  sendAndWaitTx: (tx: OctraTx, opts?: { onPoll?: (n: number) => void }) => Promise<OctraTransaction>
  // Direct helpers
  signMessage: (msg: string) => { signature: string; publicKey: string } | null
}

export function useWallet(): WalletHook {
  const network = useNetwork()
  const { wallet, secretKey, publicKey, setWallet, setKeys, resetWallet } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const refreshTimerRef = useRef<number | null>(null)

  const hasWallet = !!loadEncryptedWallet()
  const address = wallet.address
  const isUnlocked = wallet.isUnlocked
  const balance = wallet.balance
  const balanceRaw = wallet.balanceRaw
  const nonce = wallet.nonce

  // ----- Create new wallet -----
  const createWallet = useCallback(async (password: string): Promise<{ address: string; mnemonic: string }> => {
    setIsLoading(true)
    try {
      const mnemonic = await generateMnemonic()
      const { secretKey, publicKey: pk } = await mnemonicToKeyPair(mnemonic)
      const address = addressFromPublicKeySync(pk)
      const encrypted = await encryptWallet(secretKey, pk, password, mnemonic)
      saveEncryptedWallet(encrypted)

      setWallet({
        address,
        publicKey: encodeBase64(pk),
        privateKey: encodeBase64(secretKey),
        mnemonic,
        isUnlocked: true,
      })
      setKeys(secretKey, pk)

      toast.success('Wallet created', { description: `Address: ${address.slice(0, 12)}...${address.slice(-6)}` })
      return { address, mnemonic }
    } catch (e) {
      toast.error('Failed to create wallet', { description: e instanceof Error ? e.message : 'Unknown error' })
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [setWallet, setKeys])

  // ----- Import from mnemonic -----
  const importFromMnemonic = useCallback(async (mnemonic: string, password: string): Promise<string> => {
    setIsLoading(true)
    try {
      const { secretKey, publicKey: pk } = await mnemonicToKeyPair(mnemonic.trim().toLowerCase())
      const address = addressFromPublicKeySync(pk)
      const encrypted = await encryptWallet(secretKey, pk, password, mnemonic.trim())
      saveEncryptedWallet(encrypted)

      setWallet({
        address,
        publicKey: encodeBase64(pk),
        privateKey: encodeBase64(secretKey),
        mnemonic: mnemonic.trim(),
        isUnlocked: true,
      })
      setKeys(secretKey, pk)

      toast.success('Wallet imported', { description: `Address: ${address.slice(0, 12)}...${address.slice(-6)}` })
      return address
    } catch (e) {
      toast.error('Failed to import wallet', { description: e instanceof Error ? e.message : 'Invalid mnemonic' })
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [setWallet, setKeys])

  // ----- Import from private key (base64) -----
  const importFromPrivateKey = useCallback(async (privateKeyB64: string, password: string): Promise<string> => {
    setIsLoading(true)
    try {
      let skBytes: Uint8Array
      try {
        skBytes = decodeBase64(privateKeyB64.trim())
      } catch {
        throw new Error('Private key must be base64-encoded')
      }
      const { secretKey, publicKey: pk } = keyPairFromSecretKey(skBytes)
      const address = addressFromPublicKeySync(pk)
      const encrypted = await encryptWallet(secretKey, pk, password)
      saveEncryptedWallet(encrypted)

      setWallet({
        address,
        publicKey: encodeBase64(pk),
        privateKey: encodeBase64(secretKey),
        mnemonic: null,
        isUnlocked: true,
      })
      setKeys(secretKey, pk)

      toast.success('Wallet imported', { description: `Address: ${address.slice(0, 12)}...${address.slice(-6)}` })
      return address
    } catch (e) {
      toast.error('Failed to import wallet', { description: e instanceof Error ? e.message : 'Invalid private key' })
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [setWallet, setKeys])

  // ----- Unlock existing wallet -----
  const unlock = useCallback(async (password: string): Promise<string> => {
    setIsLoading(true)
    try {
      const encrypted = loadEncryptedWallet()
      if (!encrypted) throw new Error('No wallet found. Create or import one first.')

      const { secretKey, publicKey: pk, address, mnemonic } = await decryptWallet(encrypted, password)

      setWallet({
        address,
        publicKey: encodeBase64(pk),
        privateKey: encodeBase64(secretKey),
        mnemonic,
        isUnlocked: true,
      })
      setKeys(secretKey, pk)
      toast.success('Wallet unlocked')
      return address
    } catch (e) {
      toast.error('Unlock failed', { description: e instanceof Error ? e.message : 'Unknown error' })
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [setWallet, setKeys])

  // ----- Lock (clear keys from memory, keep wallet blob) -----
  const lock = useCallback(() => {
    setKeys(null, null)
    setWallet({ isUnlocked: false, privateKey: null, mnemonic: null })
    toast.info('Wallet locked')
  }, [setKeys, setWallet])

  // ----- Disconnect / remove wallet entirely -----
  const disconnect = useCallback(() => {
    clearEncryptedWallet()
    resetWallet()
    toast.info('Wallet disconnected')
  }, [resetWallet])

  // ----- Refresh balance + nonce -----
  const refresh = useCallback(async () => {
    if (!address) return
    try {
      const bal = await getBalance(network.rpcUrl, address)
      setWallet({
        balance: parseFloat(bal.balance),
        balanceRaw: bal.balance_raw,
        nonce: bal.pending_nonce ?? bal.nonce,
      })
    } catch (e) {
      // Silent fail for balance refresh
      console.warn('refresh balance failed', e)
    }
  }, [address, network.rpcUrl, setWallet])

  // Auto-refresh on unlock and periodically
  useEffect(() => {
    if (isUnlocked && address) {
      refresh()
      refreshTimerRef.current = window.setInterval(refresh, 30000)
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [isUnlocked, address, refresh])

  // ----- Sign a transaction (no submit) -----
  const signTx = useCallback((tx: OctraTx): OctraTx | null => {
    if (!secretKey || !publicKey) {
      toast.error('Wallet is locked')
      return null
    }
    try {
      const signed = signTransaction(tx, secretKey, publicKey)
      return signed
    } catch (e) {
      toast.error('Sign failed', { description: e instanceof Error ? e.message : 'Unknown error' })
      return null
    }
  }, [secretKey, publicKey])

  // ----- Sign & submit (does NOT wait for confirmation) -----
  // Returns the tx hash immediately after submission. Caller is responsible
  // for polling/waiting if needed. Use `sendAndWaitTx` if you want blocking.
  const sendTx = useCallback(async (tx: OctraTx): Promise<{ txHash: string }> => {
    if (!secretKey || !publicKey || !address) {
      throw new Error('Wallet is locked')
    }
    const signed = signTransaction(tx, secretKey, publicKey)
    const payload = signedTxToSubmitPayload(signed)
    const txHash = await submitTransaction(network.rpcUrl, payload)
    // Refresh nonce after submit (non-blocking)
    refresh().catch(() => {})
    return { txHash }
  }, [secretKey, publicKey, address, network.rpcUrl, refresh])

  // ----- Sign, submit, AND wait for confirmation -----
  const sendAndWaitTx = useCallback(async (tx: OctraTx, opts?: { onPoll?: (n: number) => void }) => {
    if (!secretKey || !publicKey || !address) {
      throw new Error('Wallet is locked')
    }
    const signed = signTransaction(tx, secretKey, publicKey)
    const payload = signedTxToSubmitPayload(signed)
    const txHash = await submitTransaction(network.rpcUrl, payload)
    const result = await waitForTransaction(network.rpcUrl, txHash, {
      onPoll: opts?.onPoll,
    })
    // Refresh balance/nonce after confirmation
    refresh().catch(() => {})
    return result
  }, [secretKey, publicKey, address, network.rpcUrl, refresh])

  // ----- Sign arbitrary message (for client-side verification) -----
  const signMessage = useCallback((msg: string): { signature: string; publicKey: string } | null => {
    if (!secretKey || !publicKey) {
      toast.error('Wallet is locked')
      return null
    }
    const msgBytes = new TextEncoder().encode(msg)
    const sig = nacl.sign.detached(msgBytes, secretKey)
    return {
      signature: encodeBase64(sig),
      publicKey: encodeBase64(publicKey),
    }
  }, [secretKey, publicKey])

  return {
    address,
    isUnlocked,
    balance,
    balanceRaw,
    nonce,
    hasWallet,
    isLoading,
    createWallet,
    importFromMnemonic,
    importFromPrivateKey,
    unlock,
    lock,
    disconnect,
    refresh,
    signTx,
    sendTx,
    sendAndWaitTx,
    signMessage,
  }
}
