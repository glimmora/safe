// ============================================================================
// components/transaction/ConfirmButton.tsx — Confirm / Execute buttons
// ============================================================================

import { useState } from 'react'
import { Check, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { useWallet } from '@/hooks/useWallet'
import { useNetwork } from '@/stores/useAppStore'
import { contractCall } from '@/lib/rpc'
import { SAFE_FUNCTIONS } from '@/types'
import { buildContractCallTx } from '@/lib/encoder'
import { classNames } from '@/utils/helpers'

type Action = 'confirm' | 'execute'

export interface ConfirmButtonProps {
  safeAddress: string
  txId: number
  action: Action
  onDone?: () => void
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  className?: string
  label?: string
}

export function ConfirmButton({
  safeAddress,
  txId,
  action,
  onDone,
  size = 'sm',
  variant,
  className,
  label,
}: ConfirmButtonProps) {
  const network = useNetwork()
  const { address, nonce, sendAndWaitTx } = useWallet()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (!address || nonce === null) {
      toast.error('Wallet not connected')
      return
    }
    setLoading(true)
    try {
      const methodName = action === 'confirm' ? SAFE_FUNCTIONS.confirmTransaction : SAFE_FUNCTIONS.executeTransaction
      const nextNonce = (nonce ?? 0) + 1
      const tx = buildContractCallTx({
        from: address,
        contractAddress: safeAddress,
        methodName,
        args: [txId],
        nonce: nextNonce,
        ou: '1000',
      })

      const result = await sendAndWaitTx(tx)

      if (result.status === 'confirmed') {
        toast.success(action === 'confirm' ? 'Transaction confirmed' : 'Transaction executed', {
          description: `Tx ${txHash_short(result.tx_hash)}`,
        })
        onDone?.()
      } else {
        toast.error(`Transaction ${result.status}`, { description: result.tx_hash })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed'
      toast.error(action === 'confirm' ? 'Confirm failed' : 'Execute failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const icon = action === 'confirm' ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />
  const defaultVariant = action === 'confirm' ? 'primary' : 'success'

  return (
    <Button
      size={size}
      variant={variant ?? defaultVariant}
      onClick={handleClick}
      isLoading={loading}
      className={className}
    >
      {loading ? null : icon}
      {label ?? (action === 'confirm' ? 'Confirm' : 'Execute')}
    </Button>
  )
}

function txHash_short(hash: string): string {
  if (!hash) return ''
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}
