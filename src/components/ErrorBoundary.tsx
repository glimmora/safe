// ============================================================================
// components/ErrorBoundary.tsx — Global React error boundary
// ----------------------------------------------------------------------------
// Catches any uncaught render error and shows a friendly fallback instead of
// a white screen. Logs to console for debugging.
// ============================================================================

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
          <div className="max-w-md w-full bg-bg-card border border-border rounded-2xl p-6 space-y-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-failed/10 text-status-failed mx-auto">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">Something went wrong</h1>
              <p className="mt-1 text-sm text-text-secondary">
                An unexpected error occurred. Try reloading the page.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] text-status-failed bg-bg-subtle border border-border rounded-lg p-3 overflow-x-auto max-h-32 text-left font-mono whitespace-pre-wrap break-all">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack.split('\n').slice(0, 4).join('\n')}`}
              </pre>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleHome}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-bg-hover hover:bg-border text-text-primary text-sm font-medium transition-colors"
              >
                <Home className="h-4 w-4" />
                Home
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
