import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, size = 'md', variant, headerActions }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  const isDanger = variant === 'danger'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal w-full ${sizes[size]} shadow-elevated flex flex-col max-h-[90vh] overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`modal-header flex-shrink-0 ${isDanger ? 'border-l-4 border-danger-600' : ''}`}>
          <h3 className={`text-sm font-bold tracking-tight min-w-0 truncate ${isDanger ? 'text-danger-600' : 'text-surface-900 dark:text-surface-100'}`}>
            {title}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerActions}
            <button type="button" className="btn-ghost p-1" onClick={onClose} aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="modal-body overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="modal-footer flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
