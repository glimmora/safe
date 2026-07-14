// ============================================================================
// components/safe/OwnersList.tsx — Display owners of a Safe
// ============================================================================

import { Crown, User } from 'lucide-react'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { Badge } from '@/components/ui/Badge'
import { useWallet } from '@/hooks/useWallet'
import { classNames } from '@/utils/helpers'

export interface OwnersListProps {
  owners: string[]
  threshold: number
  className?: string
}

export function OwnersList({ owners, threshold, className }: OwnersListProps) {
  const { address: connectedAddr } = useWallet()

  return (
    <div className={classNames('space-y-2', className)}>
      {owners.map((owner, idx) => {
        const isYou = connectedAddr && owner === connectedAddr
        return (
          <div
            key={owner}
            className="flex items-center justify-between p-3 rounded-xl bg-bg-subtle border border-border hover:border-border-hover transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={classNames(
                'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                isYou ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-hover text-text-muted'
              )}>
                {isYou ? <User className="h-4 w-4" /> : <span className="text-xs font-semibold">{idx + 1}</span>}
              </div>
              <div className="min-w-0">
                <AddressDisplay address={owner} size="sm" />
              </div>
            </div>
            {isYou && <Badge variant="info" size="sm">You</Badge>}
          </div>
        )
      })}
      {owners.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No owners loaded</p>
      )}
    </div>
  )
}
