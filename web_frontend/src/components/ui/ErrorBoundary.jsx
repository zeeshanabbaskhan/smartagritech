import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-6 rounded-2xl bg-danger-50/70 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900/50 text-center max-w-xl mx-auto my-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-danger-100 dark:bg-danger-900/60 text-danger-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
            {this.props.title || 'Something went wrong rendering this section'}
          </h3>
          <p className="text-xs text-danger-700 dark:text-danger-400 font-mono bg-white dark:bg-surface-900 p-2.5 rounded-lg border border-danger-100 dark:border-danger-950 break-words text-left">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={13} />
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
