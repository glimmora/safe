// ============================================================================
// pages/NotFoundPage.tsx — 404 page
// ============================================================================

import { useNavigate } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-status-failed/10 text-status-failed mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Page not found</h1>
      <p className="text-sm text-text-secondary mt-2 max-w-sm">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Button className="mt-6" onClick={() => navigate('/')}>
        <Home className="h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  )
}
