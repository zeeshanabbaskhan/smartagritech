import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (e) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { reload() }, [reload])

  return { data, loading, error, reload, setData }
}

export default function PageState({ loading, error, onRetry, children, empty, emptyMessage = 'No records found' }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-surface-500">
        <Loader2 className="animate-spin mb-3" size={28} />
        <p className="text-sm">Loading...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto mt-8">
        <p className="text-sm text-danger-600 mb-4">{error}</p>
        {onRetry && (
          <button type="button" className="btn-primary" onClick={onRetry}>Retry</button>
        )}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="card p-12 text-center text-surface-500 text-sm">{emptyMessage}</div>
    )
  }
  return children
}
