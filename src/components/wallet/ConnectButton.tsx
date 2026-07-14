// ============================================================================
// components/wallet/ConnectButton.tsx — Wallet connect/unlock button
// ----------------------------------------------------------------------------
// Since Octra uses ed25519 (not MetaMask/secp256k1), the "wallet" is a
// browser-generated ed25519 keypair. This button opens the wallet modal.
// ============================================================================

import { useState } from 'react'
import { Wallet, Lock, LogOut, ChevronDown } from 'lucide-react'
import { useWallet } from '@/hooks/useWallet'
import { Button } from '@/components/ui/Button'
import { AccountModal } from './AccountModal'
import { truncateAddress, classNames } from '@/utils/helpers'

export function ConnectButton() {
  const { address, isUnlocked, balance, lock, disconnect } = useWallet()
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  if (!isUnlocked || !address) {
    return (
      <>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
        <AccountModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 h-9 px-3 rounded-xl bg-bg-card border border-border hover:border-border-hover transition-colors"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-cyan text-[10px] font-bold text-white">
            {address.charAt(3).toUpperCase()}
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-xs font-mono text-text-primary">{truncateAddress(address)}</span>
            {balance !== null && (
              <span className="text-[10px] text-text-muted">{balance.toFixed(2)} OCT</span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-text-muted" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-border">
                <p className="text-[10px] text-text-muted">Connected Account</p>
                <p className="text-xs font-mono text-text-primary break-all">{address}</p>
                {balance !== null && (
                  <p className="text-xs text-text-secondary mt-1">{balance.toFixed(6)} OCT</p>
                )}
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    lock()
                    setDropdownOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  Lock Wallet
                </button>
                <button
                  onClick={() => {
                    if (confirm('Disconnect wallet? This will remove the encrypted keys from this browser.')) {
                      disconnect()
                      setDropdownOpen(false)
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-status-failed hover:bg-status-failed/10 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
