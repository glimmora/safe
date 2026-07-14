// ============================================================================
// components/layout/Header.tsx — Top header with network switcher & wallet
// ============================================================================

import { useNavigate } from 'react-router-dom'
import { Menu, Shield } from 'lucide-react'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { NetworkSwitcher } from '@/components/wallet/NetworkSwitcher'
import { NetworkStatus } from '@/components/wallet/NetworkStatus'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 lg:px-6 bg-bg/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-bg-hover text-text-secondary"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-cyan">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-text-primary hidden sm:block">Octra Safe</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <NetworkStatus />
        <NetworkSwitcher />
        <ConnectButton />
      </div>
    </header>
  )
}
