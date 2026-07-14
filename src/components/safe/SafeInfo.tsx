// ============================================================================
// components/safe/SafeInfo.tsx — Safe overview panel (balance, threshold, etc.)
// ============================================================================

import { Shield, Users, Settings2, Hash } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Badge } from '@/components/ui/Badge'
import type { SafeInfo } from '@/types'

export interface SafeInfoProps {
  safe: SafeInfo
  isOwner: boolean
}

export function SafeInfo({ safe, isOwner }: SafeInfoProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan shrink-0">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-text-primary">Multi-sig Wallet</h2>
            {!isOwner && <Badge variant="outline" size="sm">View Only</Badge>}
            {isOwner && <Badge variant="success" size="sm">Owner</Badge>}
          </div>
          <AddressDisplay address={safe.address} size="md" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
        <Stat
          icon={<Hash className="h-3 w-3" />}
          label="Balance"
          value={`${safe.balance.toFixed(4)}`}
          unit="OCT"
        />
        <Stat
          icon={<Users className="h-3 w-3" />}
          label="Owners"
          value={`${safe.ownerCount}`}
        />
        <Stat
          icon={<Shield className="h-3 w-3" />}
          label="Threshold"
          value={`${safe.threshold}`}
          unit={`/ ${safe.ownerCount}`}
        />
        <Stat
          icon={<Settings2 className="h-3 w-3" />}
          label="Pending"
          value={`${safe.pendingTxCount}`}
        />
      </div>
    </Card>
  )
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase text-text-muted mb-1">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-mono font-semibold text-text-primary">{value}</span>
        {unit && <span className="text-xs text-text-muted">{unit}</span>}
      </div>
    </div>
  )
}
