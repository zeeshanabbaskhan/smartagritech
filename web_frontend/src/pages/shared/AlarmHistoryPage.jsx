import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import Modal from '../../components/ui/Modal'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { Eye, CheckCircle } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapVariableAlarm, mapLinkageRecord } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { useDevices } from '../../context/DeviceContext'

export default function AlarmHistoryPage({ title = 'Alarm History', breadcrumb = 'Variable alarms & linkage records' }) {
  const { showToast } = useToast()
  const { selectedDeviceId, selectedDevice } = useDevices()
  const [tab, setTab] = useState('variable')
  const [selected, setSelected] = useState(null)

  const { data, loading, error, reload } = useFetch(async () => {
    const params = { limit: 100 }
    if (selectedDeviceId) params.deviceId = selectedDeviceId
    const [varRes, linkRes, devicesRes] = await Promise.all([
      emsApi.getVariableAlarmHistory(params),
      emsApi.getLinkageHistory(params),
      emsApi.getDevices({ limit: 100 }),
    ])
    const deviceMap = Object.fromEntries(list(devicesRes).map((d) => [d.id, d.name]))
    return {
      variable: list(varRes).map((a) => mapVariableAlarm(a, deviceMap[a.deviceId])),
      linkage: list(linkRes).map((r) => mapLinkageRecord(r, deviceMap[r.deviceId])),
    }
  }, [selectedDeviceId])

  const resolveAlarm = async (row) => {
    try {
      await emsApi.processVariableAlarm(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Failed to process alarm', 'error')
    }
  }

  const varColumns = [
    { key: 'deviceName', label: 'Device' },
    { key: 'variableName', label: 'Variable' },
    { key: 'triggerName', label: 'Trigger' },
    { key: 'currentValue', label: 'Value' },
    { key: 'alarmState', label: 'State', render: (v) => <span className={`badge ${v === 'ACTIVE' ? 'badge-danger' : 'badge-success'}`}>{v}</span> },
    { key: 'alarmTime', label: 'Time', render: (v) => <span className="text-xs text-surface-400">{String(v).slice(0, 16)}</span> },
  ]

  const linkColumns = [
    { key: 'deviceName', label: 'Device' },
    { key: 'triggerName', label: 'Trigger' },
    { key: 'watchedVariableName', label: 'Watched' },
    { key: 'currentValue', label: 'Value' },
    { key: 'linkedVariableName', label: 'Linked Var' },
    { key: 'action', label: 'Action' },
    { key: 'createdAt', label: 'Time', render: (v) => <span className="text-xs text-surface-400">{String(v).slice(0, 16)}</span> },
  ]

  const rows = tab === 'variable' ? (data?.variable ?? []) : (data?.linkage ?? [])

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">{title}</h2>
            <p className="breadcrumb">
              {breadcrumb}
              {selectedDevice?.name ? ` · ${selectedDevice.name}` : ''}
            </p>
          </div>
        </div>

        <DeviceSlaveSelector onChange={reload} />

        <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800">
          {[
            ['variable', 'Variable Alarms'],
            ['linkage', 'Linkage Records'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
                tab === id ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <DataTable
          columns={tab === 'variable' ? varColumns : linkColumns}
          data={rows}
          searchPlaceholder="Search..."
          actions={tab === 'variable' ? (row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => setSelected(row)} title="View"><Eye size={14} /></button>
              {row.alarmState === 'ACTIVE' && (
                <button type="button" className="btn-ghost p-1.5 text-success-600" onClick={() => resolveAlarm(row)} title="Resolve">
                  <CheckCircle size={14} />
                </button>
              )}
            </>
          ) : (row) => (
            <button type="button" className="btn-ghost p-1.5" onClick={() => setSelected(row)} title="View"><Eye size={14} /></button>
          )}
        />

        {!loading && rows.length === 0 && (
          <div className="card p-6 text-center text-sm text-surface-500">
            {selectedDeviceId ? 'No alarm history for the selected device.' : 'Select a device to view alarm history.'}
          </div>
        )}

        <Modal open={!!selected} onClose={() => setSelected(null)} title="Record Details">
          {selected && (
            <div className="space-y-2 text-xs">
              {Object.entries(selected).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-surface-500 w-32 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-surface-800">{String(v ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
