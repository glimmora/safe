// ============================================================================
// components/layout/Sidebar.tsx — Desktop sidebar navigation
// ----------------------------------------------------------------------------
// When rendered inside the Layout (default), it's `hidden lg:flex`.
// When rendered inside the mobile drawer (Layout wraps it in a div), the
// parent div provides the sizing — we use `flex` and let parent control width.
// ============================================================================

import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Shield, BookOpen, ExternalLink } from 'lucide-react'
import { classNames } from '@/utils/helpers'
import { useNetwork } from '@/stores/useAppStore'
import { APP_VERSION } from '@/utils/constants'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Create Safe', icon: PlusCircle, path: '/create' },
]

const SECONDARY_ITEMS = [
  { label: 'Octra Docs', icon: BookOpen, href: 'https://docs.octra.org' },
  { label: 'Explorer', icon: ExternalLink, href: 'https://devnet.octrascan.io' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const network = useNetwork()

  return (
    <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-bg-subtle/50">
      <div className="flex-1 py-4 px-3">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={classNames(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-border p-3 space-y-1">
        {SECONDARY_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </a>
          )
        })}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Shield className="h-3 w-3" />
          <span>v{APP_VERSION} · {network.isTestnet ? 'Devnet' : 'Mainnet'}</span>
        </div>
      </div>
    </aside>
  )
}

// Variant for mobile drawer — always flex (visible), no lg:hidden
export function SidebarMobile() {
  const navigate = useNavigate()
  const location = useLocation()
  const network = useNetwork()

  return (
    <aside className="flex w-full flex-col bg-bg-subtle h-full">
      <div className="flex-1 py-4 px-3">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={classNames(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="border-t border-border p-3 space-y-1">
        {SECONDARY_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </a>
          )
        })}
      </div>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Shield className="h-3 w-3" />
          <span>v{APP_VERSION} · {network.isTestnet ? 'Devnet' : 'Mainnet'}</span>
        </div>
      </div>
    </aside>
  )
}
