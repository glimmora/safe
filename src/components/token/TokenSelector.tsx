// ============================================================================
// components/token/TokenSelector.tsx — Dropdown for selecting an OCS-01 token
// ============================================================================

import { useState } from 'react'
import { ChevronDown, Check, Coins } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { useNetwork } from '@/stores/useAppStore'
import { getTokenBalance } from '@/lib/ocs01'
import { formatTokenAmount } from '@/lib/ocs01'
import { classNames, shortAddr } from '@/utils/helpers'

export interface TokenSelectorProps {
  value: string
  onChange: (addr: string) => void
  balanceAddress?: string  // address whose balance to display (e.g. Safe address)
  className?: string
}

export function TokenSelector({ value, onChange, balanceAddress, className }: TokenSelectorProps) {
  const tokens = useAppStore((s) => s.tokens)
  const network = useNetwork()
  const [open, setOpen] = useState(false)
  const [balances, setBalances] = useState<Record<string, number>>({})

  const selected = tokens.find((t) => t.address === value)

  // Fetch balances when dropdown opens
  const handleOpen = async () => {
    if (!open && balanceAddress && tokens.length > 0) {
      const entries = await Promise.all(
        tokens.map(async (t) => {
          try {
            const bal = await getTokenBalance(network.rpcUrl, t.address, balanceAddress)
            return [t.address, bal] as const
          } catch {
            return [t.address, 0] as const
          }
        })
      )
      const map: Record<string, number> = {}
      for (const [addr, bal] of entries) map[addr] = bal
      setBalances(map)
    }
    setOpen(!open)
  }

  if (tokens.length === 0) {
    return (
      <div className={classNames('h-11 rounded-xl bg-bg-subtle border border-border px-3 flex items-center text-xs text-text-muted', className)}>
        No tokens available. Add one first.
      </div>
    )
  }

  return (
    <div className={classNames('relative', className)}>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-11 rounded-xl bg-bg-subtle border border-border px-3 flex items-center justify-between hover:border-border-hover transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/30 to-accent-blue/30 text-[10px] font-bold text-accent-cyan shrink-0">
              {selected.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-text-primary">{selected.symbol}</span>
                <span className="text-xs text-text-muted">{selected.name}</span>
              </div>
              <p className="text-[10px] font-mono text-text-muted truncate">
                {shortAddr(selected.address)}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-sm text-text-muted">Select a token...</span>
        )}
        <ChevronDown className={classNames('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
            {tokens.map((token) => {
              const bal = balances[token.address]
              return (
                <button
                  key={token.address}
                  onClick={() => {
                    onChange(token.address)
                    setOpen(false)
                  }}
                  className={classNames(
                    'w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors border-b border-border last:border-0',
                    value === token.address && 'bg-accent-blue/5'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/30 to-accent-blue/30 text-[10px] font-bold text-accent-cyan shrink-0">
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-text-primary">{token.symbol}</span>
                        <span className="text-xs text-text-muted">{token.name}</span>
                      </div>
                      <p className="text-[10px] font-mono text-text-muted truncate">
                        {shortAddr(token.address)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {balanceAddress && bal !== undefined && (
                      <span className="text-xs font-mono text-text-secondary">
                        {formatTokenAmount(bal, token.decimals)}
                      </span>
                    )}
                    {value === token.address && <Check className="h-3.5 w-3.5 text-accent-blue" />}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
