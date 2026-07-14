// ============================================================================
// components/safe/SafeList.tsx — List of Safe cards (grid layout)
// ============================================================================

import { SafeCard, SafeCardSkeleton } from './SafeCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Shield } from 'lucide-react'
import type { SafeInfo } from '@/types'
import { useNavigate } from 'react-router-dom'

export interface SafeListProps {
  safes: SafeInfo[]
  ownedByUser: Set<string>
  loading?: boolean
}

export function SafeList({ safes, ownedByUser, loading }: SafeListProps) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SafeCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (safes.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-6 w-6" />}
        title="No Safes yet"
        description="Create your first multi-signature wallet to start managing OCT and OCS-01 tokens securely."
        action={
          <Button onClick={() => navigate('/create')}>Create New Safe</Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {safes.map((safe) => (
        <SafeCard key={safe.address} safe={safe} isOwner={ownedByUser.has(safe.address)} />
      ))}
    </div>
  )
}
