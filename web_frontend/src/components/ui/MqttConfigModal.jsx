import { Copy, CopyCheck, AlertTriangle, TerminalSquare } from 'lucide-react'
import { useState } from 'react'
import Modal from './Modal'
import { useToast } from '../../context/ToastContext'

const MQTT_DEFAULTS = {
  MQTT_BROKER_IP: '10.3.20.218',
  MQTT_BROKER_PORT: '1883',
  MQTT_TOPIC: 'SMM/Soil_Data',
}

// Shown once right after a device is created so the operator can configure
// the local machine that runs script.py. The ingest key is never retrievable
// again — it must be copied now (or regenerated later).
export default function MqttConfigModal({ open, onClose, deviceId, ingestApiKey }) {
  const { showToast } = useToast()
  const [copiedKey, setCopiedKey] = useState(null)

  const rows = [
    ['EMS_DEVICE_ID', deviceId || ''],
    ['EMS_INGEST_API_KEY', ingestApiKey || ''],
    ['MQTT_BROKER_IP', MQTT_DEFAULTS.MQTT_BROKER_IP],
    ['MQTT_BROKER_PORT', MQTT_DEFAULTS.MQTT_BROKER_PORT],
    ['MQTT_TOPIC', MQTT_DEFAULTS.MQTT_TOPIC],
  ]

  const allEnv = rows.map(([k, v]) => `${k}=${v}`).join('\n')

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(label)
      setTimeout(() => setCopiedKey((k) => (k === label ? null : k)), 2000)
    } catch {
      showToast('Copy failed — copy manually', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <TerminalSquare size={16} /> MQTT Script Config
        </span>
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => copy(allEnv, '__all__')}>
            {copiedKey === '__all__' ? <CopyCheck size={14} /> : <Copy size={14} />} Copy All
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2.5 text-warning-700">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <p className="text-xs font-semibold">API key is shown only once — copy it now.</p>
        </div>

        <p className="text-xs text-surface-500">
          Paste these into the <code className="text-surface-700">.env</code> (or environment) of the machine
          running <code className="text-surface-700">script.py</code>.
        </p>

        <div className="space-y-2">
          {rows.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-surface-400">{key}</div>
                <div className="truncate font-mono text-xs text-surface-800">{value}</div>
              </div>
              <button
                type="button"
                className="btn-ghost p-1.5"
                title={`Copy ${key}`}
                onClick={() => copy(value, key)}
              >
                {copiedKey === key ? <CopyCheck size={14} className="text-success-600" /> : <Copy size={14} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
