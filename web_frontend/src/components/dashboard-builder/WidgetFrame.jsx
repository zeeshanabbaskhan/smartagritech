import { useState, useRef, useEffect } from 'react'
import { GripVertical, MoreVertical, Settings, Trash2, Cpu } from 'lucide-react'

export default function WidgetFrame({ widget, editing, dashboardContext, onSettings, onRemove, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Resolve which device this widget belongs or relates to
  const resolvedDevice = widget.targetDevice || dashboardContext?.targetDevice || 'All Devices'

  return (
    <div className={`card h-full flex flex-col overflow-hidden group relative ${editing ? 'ring-1 ring-primary-500/20 hover:border-primary-400/60' : ''}`}>
      <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-surface-100 dark:border-surface-800 flex-shrink-0 transition-colors ${
        editing
          ? 'widget-drag-handle cursor-grab active:cursor-grabbing bg-surface-50/70 dark:bg-surface-800/50 select-none'
          : ''
      }`}>
        <div className="flex items-center gap-2 min-w-0 flex-1 pointer-events-none">
          {editing && (
            <span className="text-surface-400 dark:text-surface-500 flex-shrink-0">
              <GripVertical size={14} />
            </span>
          )}
          <div className="flex flex-col min-w-0">
            <h4 className="text-xs font-bold text-surface-800 dark:text-surface-100 truncate leading-tight">{widget.title}</h4>
            <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mt-0.5 truncate leading-none uppercase tracking-wide flex items-center gap-0.5">
              <Cpu size={8} /> Device: {resolvedDevice}{widget.targetSlave ? ` · ${widget.targetSlave}` : ''}
            </span>
          </div>
        </div>
        {editing && (
          <div className="relative flex-shrink-0 no-drag pointer-events-auto" ref={menuRef} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost p-1 no-drag" onClick={() => setMenuOpen(o => !o)}>
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg shadow-elevated z-30 py-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); onSettings() }}
                >
                  <Settings size={12} /> Widget Settings
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-100/40 dark:hover:bg-danger-950/40 flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); onRemove() }}
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 p-3 overflow-auto">
        {children}
      </div>
    </div>
  )
}
