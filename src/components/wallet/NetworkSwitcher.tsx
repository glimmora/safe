// ============================================================================
// components/wallet/NetworkSwitcher.tsx — Toggle mainnet / devnet
// ============================================================================

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useNetworkSwitcher } from '@/hooks/useNetworkSwitcher'
import { classNames } from '@/utils/helpers'

export function NetworkSwitcher() {
  const { networkId, network, switchNetwork } = useNetworkSwitcher()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={classNames(
          'flex items-center gap-2 h-9 px-3 rounded-xl border transition-colors',
          network.isTestnet
            ? 'bg-status-pending/10 border-status-pending/30 text-status-pending hover:bg-status-pending/20'
            : 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20'
        )}
      >
        <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
        <span className="text-xs font-medium hidden sm:block">
          {network.isTestnet ? 'Devnet' : 'Mainnet'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-bg-card border border-border rounded-xl shadow-xl z-50 p-1">
            {(['mainnet', 'devnet'] as const).map((id) => (
              <button
                key={id}
                onClick={() => {
                  switchNetwork(id)
                  setOpen(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-text-primary">
                    {id === 'mainnet' ? 'Mainnet' : 'Devnet'}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {id === 'mainnet' ? 'Production network' : 'Test network'}
                  </span>
                </div>
                {networkId === id && <Check className="h-4 w-4 text-accent-blue" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
