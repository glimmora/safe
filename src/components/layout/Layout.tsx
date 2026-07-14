// ============================================================================
// components/layout/Layout.tsx — App shell with sidebar + header + content
// ----------------------------------------------------------------------------
// On mobile (<lg), the sidebar is hidden and a hamburger button toggles a
// slide-in drawer. Bottom nav also provides quick navigation.
// ============================================================================

import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { Sidebar, SidebarMobile } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex flex-1">
        <Sidebar />

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative z-10 w-64 h-full border-r border-border bg-bg-subtle animate-slide-up">
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute -right-10 top-3 p-2 rounded-lg bg-bg-card border border-border text-text-secondary hover:text-text-primary"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarMobile />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <Header onMenuClick={() => setDrawerOpen(true)} />
          <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
