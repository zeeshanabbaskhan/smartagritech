import { useMemo, useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import DataCenterFilterBar from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, CheckCircle, Download } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapVariableAlarm, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { downloadCsv } from '../../utils/csv'

export default function AdminVariableAlarms() {
  const { showToast } = useToast()
  const { data, loading, error, reload, setData } = useFetch(async () => {
    const [alarmsRes, devicesRes] = await Promise.all([
      emsApi.getVariableAlarmHistory({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    const devices = list(devicesRes).map(mapDevice)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    const rows = list(alarmsRes).map((a) => mapVariableAlarm(a, deviceMap[a.deviceId]))
    return { rows, devices }
  }, [])

  const rows = data?.rows ?? []
  const devices = data?.devices ?? []

  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const [device, setDevice] = useState('')
  const [trigger, setTrigger] = useState('')
  const [variableFilter, setVariableFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applied, setApplied] = useState({ device: '', trigger: '', variable: '', dateFrom: '', dateTo: '' })

  const triggerOptions = useMemo(() => [...new Set(rows.map((r) => r.triggerName).filter(Boolean))], [rows])
  const variableOptions = useMemo(() => [...new Set(rows.map((r) => r.variable).filter(Boolean))], [rows])

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const markResolved = async (row) => {
    try {
      await emsApi.processVariableAlarm(row.id)
      setData((prev) => prev && {
        ...prev,
        rows: prev.rows.map((r) => (r.id === row.id ? { ...r, status: 'Resolved', processState: 'PROCESSED' } : r)),
      })
      showToast('Alarm marked as resolved', 'success')
    } catch (e) {
      showToast(e.message || 'Failed to resolve alarm', 'error')
    }
  }

  const handleQuery = () => setApplied({ device, trigger, variable: variableFilter, dateFrom, dateTo })

  const filtered = rows.filter((r) => {
    if (applied.device && r.device !== applied.device) return false
    if (applied.trigger && r.triggerName !== applied.trigger) return false
    if (applied.variable && r.variable !== applied.variable) return false
    const day = (r.alarmTime || '').slice(0, 10)
    if (applied.dateFrom && day && day < applied.dateFrom) return false
    if (applied.dateTo && day && day > applied.dateTo) return false
    return true
  })

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected record(s)?`)) return
    setDeleting(true)
    try {
      await emsApi.batchDeleteVariableAlarms({ ids: selectedIds })
      showToast('Selected records deleted', 'success')
      setSelectedIds([])
      reload()
    } catch (e) {
      showToast(e.message || 'Batch delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = () => {
    const header = ['Device Name', 'Trigger Name', 'Trigger Type', 'Slave Name', 'Variable', 'Current Value', 'Triggering Condition', 'Alarm Time', 'Alarm State', 'Process State']
    const csvRows = filtered.map((r) => [
      r.device, r.triggerName, r.type, r.slave, r.variable, r.actual, r.threshold, r.time, r.status,
      r.processState === 'PROCESSED' ? 'Processed' : 'Unprocessed',
    ])
    downloadCsv('variable_alarm_record.csv', header, csvRows)
  }

  const columns = [
    { key: 'device', label: 'Device Name' },
    { key: 'triggerName', label: 'Trigger Name' },
    { key: 'type', label: 'Trigger Type', render: (v) => <span className={`badge ${String(v).toLowerCase().includes('high') ? 'badge-danger' : 'badge-warning'}`}>{v}</span> },
    { key: 'slave', label: 'Slave Name' },
    { key: 'variable', label: 'Variable' },
    { key: 'actual', label: 'Current Value', render: (v) => <span className="font-mono text-xs text-primary-600">{v}</span> },
    { key: 'threshold', label: 'Triggering Condition', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'time', label: 'Alarm Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
    { key: 'status', label: 'Alarm State', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-danger' : 'badge-success'}`}>{v}</span> },
    { key: 'processState', label: 'Process State', render: (v) => <span className={`badge ${v === 'PROCESSED' ? 'badge-success' : 'badge-neutral'}`}>{v === 'PROCESSED' ? 'Processed' : 'Unprocessed'}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Data Center</h2>
            <p className="breadcrumb">Data Center &ndash; Variable Alarm Record</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={handleDownload}><Download size={14} /> Download Data</button>
            <button type="button" className="btn-secondary" onClick={handleBatchDelete} disabled={!selectedIds.length || deleting}>
              {deleting ? 'Deleting...' : 'Batch Delete'}
            </button>
          </div>
        </div>

        <DataCenterFilterBar
          devices={devices.map((d) => d.name)}
          device={device} onDeviceChange={setDevice}
          triggerOptions={triggerOptions}
          trigger={trigger} onTriggerChange={setTrigger}
          variableOptions={variableOptions}
          variable={variableFilter} onVariableChange={setVariableFilter}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          onQuery={handleQuery}
        />

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search alarms..."
          emptyMessage="No data available in table"
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
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
                ['Trigger', selected.triggerName],
                ['Type', selected.type],
                ['Slave', selected.slave],
                ['Variable', selected.variable],
                ['Current Value', selected.actual],
                ['Condition', selected.threshold],
                ['Alarm Time', selected.time],
                ['State', selected.status],
                ['Process', selected.processState === 'PROCESSED' ? 'Processed' : 'Unprocessed'],
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
