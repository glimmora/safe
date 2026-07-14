// ============================================================================
// components/wallet/NetworkStatus.tsx — Small connectivity indicator
// ----------------------------------------------------------------------------
// Polls `node_status` RPC every 15s and shows a green/red dot with the
// current epoch. Click to expand details.
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, ChevronDown, Activity } from 'lucide-react'
import { useNetwork } from '@/stores/useAppStore'
import { getNodeStatus, type NodeStatus } from '@/lib/rpc'
import { classNames } from '@/utils/helpers'

export function NetworkStatus() {
  const network = useNetwork()
  const [status, setStatus] = useState<NodeStatus | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [lastChecked, setLastChecked] = useState<number>(0)

  const check = useCallback(async () => {
    try {
      const s = await getNodeStatus(network.rpcUrl)
      setStatus(s)
      setOnline(true)
      setLastChecked(Date.now())
    } catch {
      setStatus(null)
      setOnline(false)
      setLastChecked(Date.now())
    }
  }, [network.rpcUrl])

  useEffect(() => {
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [check])

  if (online === null) {
    // Initial check still pending
    return (
      <div className="flex items-center gap-1.5 text-xs text-text-muted px-2 py-1">
        <Activity className="h-3 w-3 animate-pulse" />
        <span className="hidden sm:inline">Checking...</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={classNames(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors',
          online
            ? 'text-status-success hover:bg-status-success/10'
            : 'text-status-failed hover:bg-status-failed/10'
        )}
        aria-label={online ? 'Network online' : 'Network offline'}
        title={online ? `Epoch ${status?.current_epoch ?? '?'}` : 'RPC unreachable'}
      >
        {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        <span className="hidden md:inline">
          {online ? `#${status?.current_epoch ?? '?'}` : 'Offline'}
        </span>
        <ChevronDown className={classNames('h-2.5 w-2.5 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-bg-card border border-border rounded-xl shadow-xl z-50 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Network</span>
              <span className="font-medium text-text-primary">
                {network.isTestnet ? 'Devnet' : 'Mainnet'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Status</span>
              <span className={online ? 'text-status-success font-medium' : 'text-status-failed font-medium'}>
                {online ? '● Online' : '● Offline'}
              </span>
            </div>
            {status && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Epoch</span>
                  <span className="font-mono text-text-primary">{status.current_epoch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Network version</span>
                  <span className="font-mono text-text-primary text-[10px]">{status.network_version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Validator</span>
                  <span className="font-mono text-text-primary text-[10px] truncate ml-2">
                    {status.validator?.slice(0, 8)}...{status.validator?.slice(-4)}
                  </span>
                </div>
              </>
            )}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-text-muted">Last checked</span>
              <span className="text-text-secondary">
                {lastChecked ? new Date(lastChecked).toLocaleTimeString() : '—'}
              </span>
            </div>
            <button
              onClick={check}
              className="w-full mt-1 py-1.5 rounded-lg bg-bg-hover hover:bg-border text-text-secondary hover:text-text-primary text-xs transition-colors"
            >
              Re-check now
            </button>
          </div>
        </>
      )}
    </div>
  )
}
