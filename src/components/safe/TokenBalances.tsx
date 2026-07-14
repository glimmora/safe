// ============================================================================
// components/safe/TokenBalances.tsx — OCS-01 token balances panel
// ============================================================================

import { useState } from 'react'
import { Coins, Plus, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { AddTokenModal } from '@/components/token/AddTokenModal'
import { useAppStore, useNetwork } from '@/stores/useAppStore'
import { useTokenBalances } from '@/hooks/useTokenBalance'
import { formatTokenAmount } from '@/lib/ocs01'

export interface TokenBalancesProps {
  walletAddress: string  // the Safe's address
}

export function TokenBalances({ walletAddress }: TokenBalancesProps) {
  const tokens = useAppStore((s) => s.tokens)
  const network = useNetwork()
  const { balances, loading, refresh } = useTokenBalances(tokens, walletAddress)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-accent-cyan" />
          <h3 className="text-sm font-semibold text-text-primary">Token Balances</h3>
          <span className="text-xs text-text-muted">({tokens.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Token</span>
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {tokens.length === 0 && !loading && (
          <div className="p-6 text-center">
            <p className="text-xs text-text-muted mb-3">No OCS-01 tokens tracked</p>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Token
            </Button>
          </div>
        )}

        {loading && tokens.length === 0 && (
          <div className="p-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {tokens.map((token) => {
          const balance = balances[token.address] ?? 0
          return (
            <div key={token.address} className="flex items-center justify-between p-3 hover:bg-bg-hover/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/30 to-accent-blue/30 text-xs font-bold text-accent-cyan">
                  {token.symbol.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{token.symbol}</span>
                    <span className="text-xs text-text-muted">{token.name}</span>
                  </div>
                  <AddressDisplay address={token.address} size="sm" truncate showCopy={false} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-semibold text-text-primary">
                  {formatTokenAmount(balance, token.decimals)}
                </p>
                <p className="text-[10px] text-text-muted">{token.decimals} decimals</p>
              </div>
            </div>
          )
        })}
      </div>

      <AddTokenModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </Card>
  )
}
