import { useMemo, useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import DataCenterFilterBar from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, Download } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapLinkageRecord, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { downloadCsv } from '../../utils/csv'

export default function AdminLinkageRecords() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [recordsRes, devicesRes] = await Promise.all([
      emsApi.getLinkageHistory({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    const devices = list(devicesRes).map(mapDevice)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    const rows = list(recordsRes).map((r) => mapLinkageRecord(r, deviceMap[r.deviceId]))
    return { rows, devices }
  }, [])

  const rows = data?.rows ?? []
  const devices = data?.devices ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const [device, setDevice] = useState('')
  const [trigger, setTrigger] = useState('')
  const [variableFilter, setVariableFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applied, setApplied] = useState({ device: '', trigger: '', variable: '', dateFrom: '', dateTo: '' })

  const triggerOptions = useMemo(() => [...new Set(rows.map((r) => r.triggerName).filter(Boolean))], [rows])
  const variableOptions = useMemo(() => [...new Set(rows.map((r) => r.watchedVariableName).filter(Boolean))], [rows])

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleQuery = () => setApplied({ device, trigger, variable: variableFilter, dateFrom, dateTo })

  const filtered = rows.filter((r) => {
    if (applied.device && r.srcDevice !== applied.device) return false
    if (applied.trigger && r.triggerName !== applied.trigger) return false
    if (applied.variable && r.watchedVariableName !== applied.variable) return false
    const day = (r._raw?.firedAt || '').slice(0, 10)
    if (applied.dateFrom && day && day < applied.dateFrom) return false
    if (applied.dateTo && day && day > applied.dateTo) return false
    return true
  })

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected record(s)?`)) return
    setDeleting(true)
    try {
      await emsApi.batchDeleteLinkageHistory({ ids: selectedIds })
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
    const header = ['Device Name', 'Trigger Name', 'Trigger Type', 'Slave Name', 'Variable Name', 'Triggering Condition', 'Trigger Device', 'Linkage Time']
    const csvRows = filtered.map((r) => [
      r.srcDevice, r.triggerName, r.triggerType, r.slave, r.variable, r.condition, r.triggerDevice, r.createdAt,
    ])
    downloadCsv('linkage_record.csv', header, csvRows)
  }

  const columns = [
    { key: 'srcDevice', label: 'Device Name' },
    { key: 'triggerName', label: 'Trigger Name' },
    { key: 'triggerType', label: 'Trigger Type', render: (v) => (
      <span className={`badge ${String(v).toLowerCase().includes('high') || String(v).toUpperCase() === 'ON' ? 'badge-danger' : 'badge-warning'}`}>{v}</span>
    ) },
    { key: 'slave', label: 'Slave Name' },
    { key: 'variable', label: 'Variable Name' },
    { key: 'condition', label: 'Triggering Condition', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'triggerDevice', label: 'Trigger Device' },
    { key: 'createdAt', label: 'Linkage Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Data Center</h2>
            <p className="breadcrumb">Data Center &ndash; Linkage Record</p>
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
          searchPlaceholder="Search linkages..."
          emptyMessage="No data available in table"
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          actions={(row) => (
            <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Linkage Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Device', selected.srcDevice],
                ['Trigger', selected.triggerName],
                ['Trigger Type', selected.triggerType],
                ['Slave', selected.slave],
                ['Variable', selected.variable],
                ['Condition', selected.condition],
                ['Trigger Device', selected.triggerDevice],
                ['Linkage Time', selected.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
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
