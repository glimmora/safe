// ============================================================================
// components/settings/AddOwner.tsx — Submit add-owner tx to Safe
// ============================================================================

import { useState } from 'react'
import { UserPlus, AlertCircle, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useWallet } from '@/hooks/useWallet'
import { useNetwork } from '@/stores/useAppStore'
import { contractCall } from '@/lib/rpc'
import { SAFE_FUNCTIONS } from '@/types'
import { buildContractCallTx } from '@/lib/encoder'
import { encodeSafeAddOwnerTx } from '@/lib/ocs01'
import { isValidOctraAddress } from '@/lib/signer'

export interface AddOwnerProps {
  safeAddress: string
  currentOwnerCount: number
  onSubmitted?: () => void
}

export function AddOwner({ safeAddress, currentOwnerCount, onSubmitted }: AddOwnerProps) {
  const network = useNetwork()
  const { address, nonce, sendAndWaitTx } = useWallet()
  const [newOwner, setNewOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const valid = isValidOctraAddress(newOwner)
  const canSubmit = valid && !!address

  const handleSubmit = async () => {
    if (!address || nonce === null) {
      toast.error('Wallet not connected')
      return
    }
    setLoading(true)
    setShowConfirm(false)
    try {
      const safeTx = encodeSafeAddOwnerTx(newOwner)
      const nextNonce = (nonce ?? 0) + 1
      const tx = buildContractCallTx({
        from: address,
        contractAddress: safeAddress,
        methodName: SAFE_FUNCTIONS.submitTransaction,
        args: [safeTx.to, safeTx.value, safeTx.data],
        nonce: nextNonce,
        ou: '1000',
      })
      const result = await sendAndWaitTx(tx)
      if (result.status === 'confirmed') {
        toast.success('Add-owner transaction submitted', {
          description: 'Other owners must confirm and execute it.',
        })
        setNewOwner('')
        onSubmitted?.()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submit failed'
      toast.error('Failed to submit', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">
          <UserPlus className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Add Owner</h3>
          <p className="text-xs text-text-secondary">Add a new co-owner to this Safe.</p>
        </div>
      </div>

      <Input
        label="New Owner Address"
        placeholder="oct..."
        value={newOwner}
        onChange={(e) => setNewOwner(e.target.value)}
        error={newOwner && !valid ? 'Invalid Octra address' : undefined}
        className="font-mono text-xs"
      />

      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-status-pending/5 border border-status-pending/20">
        <AlertCircle className="h-3.5 w-3.5 text-status-pending shrink-0 mt-0.5" />
        <p className="text-[11px] text-status-pending">
          This will create a multi-sig transaction. Owners ({currentOwnerCount}) must confirm and execute it before the new owner is added.
        </p>
      </div>

      <Button
        disabled={!canSubmit}
        onClick={() => setShowConfirm(true)}
        className="w-full"
      >
        <UserPlus className="h-4 w-4" />
        Submit Add-Owner Transaction
      </Button>

      <Modal
        isOpen={showConfirm}
        onClose={() => !loading && setShowConfirm(false)}
        title="Confirm Add Owner"
        description="A multi-sig transaction will be submitted to the Safe."
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-bg-subtle border border-border">
            <p className="text-xs text-text-muted mb-1">New Owner</p>
            <p className="text-xs font-mono text-text-primary break-all">{newOwner}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)} disabled={loading}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm & Submit
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
