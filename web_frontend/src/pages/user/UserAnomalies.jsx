import { useState } from 'react'
import { Eye, AlertTriangle } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapAnomaly } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const severityBadge = { High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-info' }

export default function UserAnomalies() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getAnomalies({ limit: 100 })).map(mapAnomaly),
    []
  )
  const [viewing, setViewing] = useState(null)

  const activeCount = (rows ?? []).filter((a) => a.status === 'Active').length
  const resolvedCount = (rows ?? []).filter((a) => a.status === 'Resolved').length

  const handleAcknowledge = async (row) => {
    if (row.status !== 'Active') return
    try {
      await emsApi.acknowledgeAnomaly(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Acknowledge failed', 'error')
    }
  }

  const columns = [
    { key: 'type', label: 'Anomaly Type' },
    { key: 'device', label: 'Device' },
    { key: 'variable', label: 'Variable' },
    { key: 'desc', label: 'Description' },
    { key: 'time', label: 'Detected At', render: (v) => <span className="font-mono text-xs text-surface-400">{v}</span> },
    { key: 'severity', label: 'Severity', render: (v) => <span className={`badge ${severityBadge[v] || 'badge-neutral'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-danger' : 'badge-success'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Anomalies</h2>
            <p className="breadcrumb">User / Anomalies</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-danger flex items-center gap-1"><AlertTriangle size={11} /> {activeCount} Active</span>
            <span className="badge badge-success">{resolvedCount} Resolved</span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search anomalies..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5 rounded" title="View Details" onClick={() => setViewing(row)}><Eye size={14} /></button>
              {row.status === 'Active' && (
                <button type="button" className="btn-ghost text-xs px-2 py-1" onClick={() => handleAcknowledge(row)}>Ack</button>
              )}
            </>
          )}
        />

        <Modal open={!!viewing} onClose={() => setViewing(null)} title="Anomaly Details" size="md">
          {viewing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <span className={`badge ${severityBadge[viewing.severity] || 'badge-neutral'}`}>{viewing.severity} Severity</span>
                <span className={`badge ${viewing.status === 'Active' ? 'badge-danger' : 'badge-success'}`}>{viewing.status}</span>
              </div>
              {[['Anomaly Type', viewing.type], ['Device', viewing.device], ['Variable', viewing.variable], ['Description', viewing.desc], ['Detected At', viewing.time]].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm gap-4">
                  <span className="text-surface-400 flex-shrink-0">{label}</span>
                  <span className="text-surface-900 font-medium text-right">{val}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
