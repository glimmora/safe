// ============================================================================
// components/safe/SafeCard.tsx — Card showing a Safe summary
// ============================================================================

import { useNavigate } from 'react-router-dom'
import { Users, Shield, Clock, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Skeleton } from '@/components/ui/Skeleton'
import type { SafeInfo } from '@/types'

export interface SafeCardProps {
  safe: SafeInfo
  isOwner?: boolean
}

export function SafeCard({ safe, isOwner }: SafeCardProps) {
  const navigate = useNavigate()

  return (
    <Card hover onClick={() => navigate(`/safe/${safe.address}`)} className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-cyan">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">Safe</span>
              {isOwner && <Badge variant="info" size="sm">Owner</Badge>}
            </div>
            <AddressDisplay address={safe.address} size="sm" />
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-text-muted" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        <div>
          <p className="text-[10px] uppercase text-text-muted">Balance</p>
          <p className="text-sm font-mono font-semibold text-text-primary mt-0.5">
            {safe.balance.toFixed(2)} <span className="text-text-muted text-xs">OCT</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted flex items-center gap-1">
            <Users className="h-2.5 w-2.5" /> Owners
          </p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">{safe.ownerCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">Threshold</p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">
            {safe.threshold} / {safe.ownerCount}
          </p>
        </div>
      </div>

      {safe.pendingTxCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-status-pending">
          <Clock className="h-3 w-3" />
          <span>{safe.pendingTxCount} pending transaction{safe.pendingTxCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </Card>
  )
}

export function SafeCardSkeleton() {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </Card>
  )
}
