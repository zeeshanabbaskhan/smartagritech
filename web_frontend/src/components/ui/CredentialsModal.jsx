import { useState } from 'react'
import { Copy, Check, KeyRound } from 'lucide-react'
import Modal from './Modal'

/**
 * One-time credentials reveal after create / password reset.
 * Password is never stored in the DB in plaintext — show only from the create response.
 */
export default function CredentialsModal({
  open,
  onClose,
  title = 'Portal access credentials',
  subtitle = 'Share these with the user so they can sign in. This password is shown only once.',
  email,
  password,
  extraFields = [],
}) {
  const [copied, setCopied] = useState(null)

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(String(value ?? ''))
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch (_) {}
  }

  const copyAll = () => {
    const lines = [
      `Email: ${email}`,
      `Password: ${password}`,
      ...extraFields.map(([label, value]) => `${label}: ${value}`),
    ]
    copy('all', lines.join('\n'))
  }

  const rows = [
    ['Email', email, 'email'],
    ['Password', password, 'password'],
    ...extraFields.map(([label, value], i) => [label, value, `extra-${i}`]),
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={copyAll}>
            {copied === 'all' ? <Check size={14} /> : <Copy size={14} />}
            {copied === 'all' ? 'Copied' : 'Copy all'}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 border border-warning-200 text-warning-800 text-xs">
          <KeyRound size={14} className="mt-0.5 flex-shrink-0" />
          <p>{subtitle}</p>
        </div>
        <div className="space-y-2">
          {rows.map(([label, value, key]) => (
            <div key={key} className="flex items-center gap-3 p-2.5 inset-panel">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-surface-500">{label}</p>
                <p className="text-sm font-semibold text-surface-900 font-mono break-all">{value || '—'}</p>
              </div>
              <button
                type="button"
                className="btn-ghost p-1.5 flex-shrink-0"
                title={`Copy ${label}`}
                onClick={() => copy(key, value)}
              >
                {copied === key ? <Check size={14} className="text-success-600" /> : <Copy size={14} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
