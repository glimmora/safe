// ============================================================================
// components/ui/AddressDisplay.tsx — Address with copy + explorer link
// ============================================================================

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useNetwork } from '@/stores/useAppStore'
import { copyToClipboard, truncateAddress, classNames } from '@/utils/helpers'

export interface AddressDisplayProps {
  address: string
  className?: string
  truncate?: boolean
  showCopy?: boolean
  showLink?: boolean
  prefix?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export function AddressDisplay({
  address,
  className,
  truncate = true,
  showCopy = true,
  showLink = true,
  prefix,
  size = 'md',
}: AddressDisplayProps) {
  const network = useNetwork()
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const display = truncate ? truncateAddress(address) : address

  return (
    <div className={classNames('inline-flex items-center gap-1.5 font-mono', SIZES[size], className)}>
      {prefix && <span className="text-text-muted">{prefix}</span>}
      <span className="text-text-primary">{display}</span>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="Copy address"
        >
          {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      {showLink && (
        <a
          href={network.explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-blue transition-colors"
          title="View on explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
