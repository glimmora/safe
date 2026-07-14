// ============================================================================
// components/layout/MobileNav.tsx — Bottom navigation for mobile
// ============================================================================

import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle } from 'lucide-react'
import { classNames } from '@/utils/helpers'

const NAV_ITEMS = [
  { label: 'Home', icon: LayoutDashboard, path: '/' },
  { label: 'Create', icon: PlusCircle, path: '/create' },
]

export function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-bg-card/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around h-full">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={classNames(
                'flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-lg transition-colors',
                active ? 'text-accent-blue' : 'text-text-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
