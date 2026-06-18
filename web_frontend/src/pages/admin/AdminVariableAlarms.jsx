import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, CheckCircle } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapVariableAlarm, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

export default function AdminVariableAlarms() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload, setData } = useFetch(async () => {
    const [alarmsRes, devicesRes] = await Promise.all([
      emsApi.getVariableAlarmHistory({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    const deviceMap = Object.fromEntries(list(devicesRes).map((d) => [d.id, mapDevice(d).name]))
    return list(alarmsRes).map((a) => mapVariableAlarm(a, deviceMap[a.deviceId]))
  }, [])

  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const markResolved = async (row) => {
    try {
      await emsApi.processVariableAlarm(row.id)
      setData((prev) => prev?.map((r) => (r.id === row.id ? { ...r, status: 'Resolved' } : r)))
    } catch (e) {
      showToast(e.message || 'Failed to resolve alarm', 'error')
    }
  }

  const columns = [
    { key: 'device', label: 'Device Name' },
    { key: 'variable', label: 'Variable Name' },
    { key: 'type', label: 'Alarm Type', render: (v) => <span className={`badge ${v?.includes?.('high') || v === 'High' ? 'badge-danger' : 'badge-warning'}`}>{v}</span> },
    { key: 'threshold', label: 'Threshold', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'actual', label: 'Actual Value', render: (v) => <span className="font-mono text-xs text-primary-600">{v}</span> },
    { key: 'time', label: 'Triggered At', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-danger' : 'badge-success'}`}>{v}</span> },
  ]

  const data = rows ?? []

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Variable Alarms</h2>
            <p className="breadcrumb">Admin / Variable Alarms</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-danger">{data.filter((d) => d.status === 'Active').length} Active</span>
            <span className="badge badge-success">{data.filter((d) => d.status === 'Resolved').length} Resolved</span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Search alarms..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              {row.status === 'Active' && (
                <button type="button" className="btn-ghost p-1.5 text-success-600" onClick={() => markResolved(row)} title="Mark Resolved">
                  <CheckCircle size={14} />
                </button>
              )}
            </>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Alarm Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Device', selected.device],
                ['Variable', selected.variable],
                ['Type', selected.type],
                ['Threshold', selected.threshold],
                ['Actual', selected.actual],
                ['Triggered', selected.time],
                ['Status', selected.status],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
