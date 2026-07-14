// ============================================================================
// src/App.tsx — Root component with router and global providers
// ============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { CreateSafePage } from '@/pages/CreateSafePage'
import { SafeDetailPage } from '@/pages/SafeDetailPage'
import { TransactionDetailPage } from '@/pages/TransactionDetailPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/create" element={<CreateSafePage />} />
          <Route path="/safe/:safeAddress" element={<SafeDetailPage />} />
          <Route path="/safe/:safeAddress/tx/:txId" element={<TransactionDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#12121a',
            border: '1px solid #1e1e2e',
            color: '#e4e4e7',
          },
        }}
      />
    </BrowserRouter>
  )
}

export default App
