import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-lg shadow-floating text-sm font-medium max-w-sm animate-modal-entry ${
          toast.type === 'error' ? 'bg-danger-600 text-white' :
          toast.type === 'success' ? 'bg-success-600 text-white' :
          'bg-surface-900 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  return ctx ?? { showToast: (message) => { window.alert(message) } }
}
